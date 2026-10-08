import { can } from "@adpulse/access-policy";
import { AppError } from "#shared/domain/index.js";
import type { ActorContext, Clock, IdGenerator, UnitOfWork } from "#shared/application/index.js";
import type { AuditWriter } from "#modules/audit/index.js";
import { costPerLead } from "../domain/money.js";
import { addMonths, hasEnded, monthsBetween, recentEnded, type Month } from "../domain/month.js";
import {
  AVAILABLE_MONTHS,
  MAX_CHOSEN_ADS,
  computeFigures,
  describeFigures,
  effectiveLeads,
  keepRunningAds,
  suggestAds,
  trendStart,
  type ReportFigures,
  type ReportRecord,
} from "../domain/report.js";
import { coverKey, coverType } from "../domain/cover.js";
import type { ReportChange, ReportCoverStorage, ReportMetrics, ReportProject, ReportProjectReach, ReportRepository } from "./ports.js";

export interface ReportEdit {
  readonly leadsOverride?: number | null;
  readonly messengerContacts?: number | null;
  readonly conclusions?: unknown;
  readonly plan?: unknown;
  readonly adIds?: readonly string[];
}

export interface ReportDependencies {
  readonly reports: ReportRepository;
  readonly projects: ReportProjectReach;
  readonly metrics: ReportMetrics;
  readonly covers: ReportCoverStorage;
  readonly audit: AuditWriter;
  readonly unitOfWork: UnitOfWork;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}

export function createReportUseCases(d: ReportDependencies) {
  const editor = (actor: ActorContext) => can(actor, "update", "report");

  async function projectOf(actor: ActorContext, projectId: string): Promise<ReportProject> {
    const project = await d.projects.findReachable(actor, projectId);
    if (!project) throw new AppError("not-found", "Project not found");
    return project;
  }

  async function reportOf(actor: ActorContext, projectId: string, id: string) {
    const project = await projectOf(actor, projectId);
    const report = await d.reports.find(project.id, id);
    if (!report || (report.status === "DRAFT" && !editor(actor))) throw new AppError("not-found", "Report not found");
    return { project, report };
  }

  function requireEditor(actor: ActorContext) {
    if (!editor(actor)) throw new AppError("forbidden", "Your role may not change reports");
  }

  async function figuresFor(projectId: string, month: Month): Promise<ReportFigures> {
    const from = trendStart(month);
    const [firstMonth, totals, corrections, ads] = await Promise.all([
      d.metrics.firstMonth(projectId),
      d.metrics.monthTotals(projectId, from, month),
      d.reports.corrections(projectId, monthsBetween(from, addMonths(month, -1))),
      d.metrics.adTotals(projectId, month),
    ]);
    return computeFigures({ month, firstMonth, totals, corrections, ads });
  }

  function describe(actor: ActorContext, report: ReportRecord) {
    const { runningAds, ...figures } = describeFigures(report);
    const staff = editor(actor);
    return {
      id: report.id,
      projectId: report.projectId,
      month: report.month,
      status: report.status,
      currency: report.currency,
      ...figures,
      messengerContacts: report.messengerContacts,
      hasCover: report.coverKey !== null,
      conclusions: report.conclusions ?? null,
      plan: report.plan ?? null,
      publishedAt: report.publishedAt?.toISOString() ?? null,
      createdAt: report.createdAt.toISOString(),
      updatedAt: report.updatedAt.toISOString(),
      ...(staff ? {
        computedAt: report.computedAt.toISOString(),
        computedLeads: report.figures.leads,
        leadsOverride: report.leadsOverride,
        runningAds,
      } : {}),
    };
  }

  function summarize(report: ReportRecord) {
    const leads = effectiveLeads(report);
    return {
      id: report.id,
      projectId: report.projectId,
      month: report.month,
      status: report.status,
      currency: report.currency,
      spend: report.figures.spend,
      leads,
      costPerLead: costPerLead(report.figures.spend, leads),
      publishedAt: report.publishedAt?.toISOString() ?? null,
    };
  }

  async function change(
    actor: ActorContext,
    project: ReportProject,
    report: ReportRecord,
    next: ReportChange,
    summary: string,
  ) {
    const updated = await d.unitOfWork.run(async (context) => {
      const saved = await d.reports.update(context, report.id, next);
      await d.audit.append(context, {
        action: "UPDATE", entityType: "report", entityId: report.id,
        clientId: project.clientId, projectId: project.id, summary,
        changes: { month: report.month, fields: Object.keys(next) },
      }, actor);
      return saved;
    });
    return describe(actor, updated);
  }

  return {
    async list(actor: ActorContext, projectId: string) {
      const project = await projectOf(actor, projectId);
      const all = await d.reports.list(project.id);
      const staff = editor(actor);
      const visible = staff ? all : all.filter((report) => report.status === "PUBLISHED");
      let available: Month[] = [];
      if (can(actor, "create", "report")) {
        const taken = new Set(all.map((report) => report.month));
        available = recentEnded(await d.metrics.timezones(project.id), d.clock.now(), AVAILABLE_MONTHS)
          .filter((month) => !taken.has(month));
      }
      return { reports: visible.map(summarize), available };
    },

    async listAll(actor: ActorContext, projectId?: string) {
      const reachable = await d.projects.listReachable(actor);
      const ids = reachable.map((project) => project.id).filter((id) => projectId === undefined || id === projectId);
      const all = await d.reports.listForProjects(ids);
      const visible = editor(actor) ? all : all.filter((report) => report.status === "PUBLISHED");
      return visible.map(summarize);
    },

    async readById(actor: ActorContext, id: string) {
      const found = await d.reports.findById(id);
      if (!found) throw new AppError("not-found", "Report not found");
      const { report } = await reportOf(actor, found.projectId, id);
      return describe(actor, report);
    },

    async generate(actor: ActorContext, projectId: string, month: Month) {
      const project = await projectOf(actor, projectId);
      requireEditor(actor);
      if (!hasEnded(month, await d.metrics.timezones(project.id), d.clock.now())) {
        throw new AppError("validation", "A report covers a month that has ended");
      }
      if (await d.reports.exists(project.id, month)) {
        throw new AppError("conflict", "The project already has a report for this month");
      }
      const figures = await figuresFor(project.id, month);
      const created = await d.unitOfWork.run(async (context) => {
        const report = await d.reports.create(context, {
          id: d.ids.generate(),
          projectId: project.id,
          month,
          currency: project.budgetCurrency,
          figures,
          computedAt: d.clock.now(),
          adIds: suggestAds(figures.ads),
          createdById: actor.membershipId,
        });
        await d.audit.append(context, {
          action: "CREATE", entityType: "report", entityId: report.id,
          clientId: project.clientId, projectId: project.id,
          summary: `Generated the ${month} report`,
          changes: { month },
        }, actor);
        return report;
      });
      return describe(actor, created);
    },

    async refresh(actor: ActorContext, projectId: string, id: string) {
      const { project, report } = await reportOf(actor, projectId, id);
      requireEditor(actor);
      const figures = await figuresFor(project.id, report.month);
      return change(actor, project, report, {
        figures,
        computedAt: d.clock.now(),
        adIds: keepRunningAds(report.adIds, figures),
      }, `Refreshed the ${report.month} report`);
    },

    async edit(actor: ActorContext, projectId: string, id: string, edit: ReportEdit) {
      const { project, report } = await reportOf(actor, projectId, id);
      requireEditor(actor);
      if (edit.adIds) {
        const running = new Set(report.figures.ads.map((ad) => ad.adId));
        if (edit.adIds.length > MAX_CHOSEN_ADS) {
          throw new AppError("validation", `A report shows at most ${MAX_CHOSEN_ADS} ads`);
        }
        if (new Set(edit.adIds).size !== edit.adIds.length) {
          throw new AppError("validation", "An ad is chosen once");
        }
        if (edit.adIds.some((adId) => !running.has(adId))) {
          throw new AppError("validation", "Only ads that spent in the report's month can be chosen");
        }
      }
      return change(actor, project, report, edit, `Edited the ${report.month} report`);
    },

    async publish(actor: ActorContext, projectId: string, id: string) {
      const { project, report } = await reportOf(actor, projectId, id);
      requireEditor(actor);
      if (report.status === "PUBLISHED") return describe(actor, report);
      return change(actor, project, report, { status: "PUBLISHED", publishedAt: d.clock.now() }, `Published the ${report.month} report`);
    },

    async unpublish(actor: ActorContext, projectId: string, id: string) {
      const { project, report } = await reportOf(actor, projectId, id);
      requireEditor(actor);
      if (report.status === "DRAFT") return describe(actor, report);
      return change(actor, project, report, { status: "DRAFT", publishedAt: null }, `Returned the ${report.month} report to draft`);
    },

    async setCover(actor: ActorContext, projectId: string, id: string, bytes: Uint8Array) {
      const { project, report } = await reportOf(actor, projectId, id);
      requireEditor(actor);
      const contentType = coverType(bytes);
      if (!contentType) throw new AppError("validation", "A cover is a JPEG, PNG or WebP image up to 10 MB");
      const key = coverKey(report.id);
      await d.covers.write(key, bytes, contentType);
      return change(actor, project, report, { coverKey: key, coverContentType: contentType }, `Set the cover of the ${report.month} report`);
    },

    async removeCover(actor: ActorContext, projectId: string, id: string) {
      const { project, report } = await reportOf(actor, projectId, id);
      requireEditor(actor);
      if (!report.coverKey) return describe(actor, report);
      const described = await change(actor, project, report, { coverKey: null, coverContentType: null }, `Removed the cover of the ${report.month} report`);
      await d.covers.remove(report.coverKey);
      return described;
    },

    async readCover(actor: ActorContext, projectId: string, id: string) {
      const { report } = await reportOf(actor, projectId, id);
      const stored = report.coverKey ? await d.covers.read(report.coverKey) : null;
      if (!stored) throw new AppError("not-found", "Cover not found");
      return stored;
    },

    async remove(actor: ActorContext, projectId: string, id: string) {
      const { project, report } = await reportOf(actor, projectId, id);
      if (!can(actor, "delete", "report")) throw new AppError("forbidden", "Your role may not delete reports");
      await d.unitOfWork.run(async (context) => {
        await d.reports.delete(context, report.id);
        await d.audit.append(context, {
          action: "DELETE", entityType: "report", entityId: report.id,
          clientId: project.clientId, projectId: project.id,
          summary: `Deleted the ${report.month} report`,
          changes: { month: report.month },
        }, actor);
      });
      if (report.coverKey) await d.covers.remove(report.coverKey);
    },
  };
}

export type ReportUseCases = ReturnType<typeof createReportUseCases>;
