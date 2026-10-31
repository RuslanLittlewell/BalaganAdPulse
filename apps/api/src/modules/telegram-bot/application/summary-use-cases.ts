import type { ActorContext } from "#shared/application/index.js";
import {
  performanceOf,
  type CurrencyPerformance,
  type KpiAccount,
  type ProjectFigures,
  type TypedPerformance,
} from "#modules/campaigns/index.js";
import {
  enabledKpiInput,
  kpiReading,
  kpiStanding,
  projectKpiPercent,
  type KpiFigures,
  type KpiInput,
  type KpiReading,
  type KpiStanding,
} from "#modules/kpi/index.js";
import { localMoment } from "../domain/moment.js";
import {
  MAX_LAGGING,
  PROJECTS_PER_PAGE,
  clampPage,
  pageCount,
  periodRange,
  type DayRange,
  type SummaryPeriod,
} from "../domain/summary.js";
import { botActorOf } from "./link-use-cases.js";
import type { SummaryDependencies, SummaryProject } from "./ports.js";

export interface KpiLine {
  readonly kpi: KpiInput;
  readonly account: KpiAccount | null;
  readonly reading: KpiReading;
  readonly standing: KpiStanding;
}

export interface ProjectSummary {
  readonly project: SummaryProject;
  readonly period: SummaryPeriod;
  readonly range: DayRange;
  readonly page: number;
  readonly performance: TypedPerformance;
  readonly kpis: readonly KpiLine[];
}

export interface LaggingProject {
  readonly name: string;
  readonly percent: number;
  readonly standing: KpiStanding;
}

export interface DashboardSummary {
  readonly period: SummaryPeriod;
  readonly range: DayRange;
  readonly currencies: readonly CurrencyPerformance[];
  readonly month: DayRange;
  readonly standings: Readonly<Record<KpiStanding, number>>;
  readonly lagging: readonly LaggingProject[];
  readonly moreLagging: number;
}

export interface ProjectPage {
  readonly page: number;
  readonly pages: number;
  readonly projects: readonly SummaryProject[];
}

export type SummaryOutcome<T> =
  | { readonly kind: "unlinked" }
  | { readonly kind: "forbidden" }
  | { readonly kind: "gone" }
  | { readonly kind: "ready"; readonly value: T };

type Member =
  | { readonly kind: "unlinked" | "forbidden" }
  | { readonly kind: "member"; readonly actor: ActorContext };

const NOTHING: TypedPerformance = { ...performanceOf([]), resultTypes: [] };

const figuresOf = (entry: ProjectFigures | undefined) => (account: KpiAccount | null): KpiFigures => {
  if (!entry) return NOTHING;
  if (!account) return entry.performance;
  return entry.accounts.find((each) => each.channel === account.channel && each.accountId === account.accountId)
    ?.performance ?? NOTHING;
};

const byName = (a: SummaryProject, b: SummaryProject) => a.name.localeCompare(b.name, "ru") || a.id.localeCompare(b.id);

const ready = <T>(value: T): SummaryOutcome<T> => ({ kind: "ready", value });

export function createSummaryUseCases(d: SummaryDependencies) {
  const member = async (chatId: number): Promise<Member> => {
    const membershipId = await d.links.memberOf(chatId);
    if (membershipId === null) return { kind: "unlinked" };
    const actor = await botActorOf(d.members, membershipId);
    return actor ? { kind: "member", actor } : { kind: "forbidden" };
  };

  const today = () => localMoment(d.clock.now(), d.timeZone).date;

  const projects = async (actor: ActorContext) => [...(await d.reads.projects(actor))].sort(byName);

  return {
    async menu(chatId: number): Promise<SummaryOutcome<null>> {
      const from = await member(chatId);
      return from.kind === "member" ? ready(null) : from;
    },

    async dashboard(chatId: number, period: SummaryPeriod): Promise<SummaryOutcome<DashboardSummary>> {
      const from = await member(chatId);
      if (from.kind !== "member") return from;
      const day = today();
      const range = periodRange(period, day);
      const month = periodRange("m", day);
      const [reachable, monthly, currencies] = await Promise.all([
        d.reads.projects(from.actor),
        d.reads.projectFigures(from.actor, month),
        d.reads.agencyFigures(from.actor, range),
      ]);
      const byProject = new Map(monthly.map((entry) => [entry.projectId, entry]));
      const standings: Record<KpiStanding, number> = { met: 0, behind: 0, danger: 0, none: 0 };
      const lagging: LaggingProject[] = [];
      for (const project of reachable) {
        if (!project.kpiTracked) continue;
        const entry = byProject.get(project.id);
        const percent = entry ? projectKpiPercent(entry.kpis, figuresOf(entry), month) : null;
        const standing = kpiStanding(percent);
        standings[standing] += 1;
        if (percent !== null && standing !== "met") lagging.push({ name: project.name, percent, standing });
      }
      lagging.sort((a, b) => a.percent - b.percent || a.name.localeCompare(b.name, "ru"));
      return ready({
        period,
        range,
        currencies: [...currencies].sort((a, b) => b.performance.spend - a.performance.spend),
        month,
        standings,
        lagging: lagging.slice(0, MAX_LAGGING),
        moreLagging: Math.max(0, lagging.length - MAX_LAGGING),
      });
    },

    async projects(chatId: number, page: number): Promise<SummaryOutcome<ProjectPage>> {
      const from = await member(chatId);
      if (from.kind !== "member") return from;
      const all = await projects(from.actor);
      const shown = clampPage(page, all.length);
      return ready({
        page: shown,
        pages: pageCount(all.length),
        projects: all.slice(shown * PROJECTS_PER_PAGE, (shown + 1) * PROJECTS_PER_PAGE),
      });
    },

    async project(
      chatId: number, projectId: string, period: SummaryPeriod, page: number,
    ): Promise<SummaryOutcome<ProjectSummary>> {
      const from = await member(chatId);
      if (from.kind !== "member") return from;
      const project = (await projects(from.actor)).find((each) => each.id === projectId);
      if (!project) return { kind: "gone" };
      const range = periodRange(period, today());
      const entry = (await d.reads.projectFigures(from.actor, range)).find((each) => each.projectId === projectId);
      const measure = figuresOf(entry);
      const kpis = (entry?.kpis ?? []).flatMap((carried): KpiLine[] => {
        const kpi = enabledKpiInput(carried);
        if (!kpi) return [];
        const reading = kpiReading(kpi, measure(carried.account), range);
        const percent = reading.percent === null || !Number.isFinite(reading.percent) ? null : Math.round(reading.percent);
        return [{ kpi, account: carried.account, reading, standing: kpiStanding(percent) }];
      });
      return ready({ project, period, range, page, performance: entry?.performance ?? NOTHING, kpis });
    },
  };
}

export type SummaryUseCases = ReturnType<typeof createSummaryUseCases>;
