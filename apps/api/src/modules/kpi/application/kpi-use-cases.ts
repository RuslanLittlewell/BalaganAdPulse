import { can } from '@adpulse/access-policy';
import { AppError } from '#shared/domain/index.js';
import type { ActorContext, UnitOfWork } from '#shared/application/index.js';
import type { AuditWriter } from '#modules/audit/index.js';
import {
  MANUAL_KPI, MAX_PROJECT_KPIS, normalizeAmount,
  type Kpi, type KpiInput, type KpiLevel, type KpiOwner, type NewProjectKpi, type ProjectKpiInput,
} from '../domain/kpi.js';
import type { KpiReach, KpiRepository, ProjectKpiEvents, ProjectKpiRepository } from './ports.js';

const snapshot = (kpi: Kpi | null): Record<string, string> | null => {
  if (!kpi) return null;
  return kpi.metric === MANUAL_KPI
    ? { metric: kpi.metric, name: kpi.name, value: kpi.value, target: kpi.target }
    : { metric: kpi.metric, target: kpi.target };
};

const projectSnapshot = (kpi: NewProjectKpi): Record<string, string | boolean> => ({ ...snapshot(kpi)!, enabled: kpi.enabled });

function normalized(input: KpiInput, updatedAt: Date): Kpi {
  const target = normalizeAmount(input.target);
  return input.metric === MANUAL_KPI
    ? { metric: input.metric, name: input.name.trim(), value: normalizeAmount(input.value), target, updatedAt }
    : { metric: input.metric, target, updatedAt };
}

export function createKpiUseCases(d: {
  kpis: KpiRepository;
  projectKpis: ProjectKpiRepository;
  reach: KpiReach;
  audit: AuditWriter;
  unitOfWork: UnitOfWork;
  clock: { now(): Date };
  events: ProjectKpiEvents;
}) {
  async function ownerOf(actor: ActorContext, level: KpiLevel): Promise<KpiOwner> {
    if (level.kind === 'organization') {
      if (!can(actor, 'update', 'organization')) throw new AppError('forbidden', 'Your role may not manage the organization KPI');
      return { entityType: 'organization', entityId: actor.orgId, clientId: null, projectId: null, campaignId: null };
    }
    const campaign = await d.reach.campaigns.findReachable(actor, level.id);
    const project = campaign && await d.reach.projects.findReachable(actor, campaign.projectId);
    if (!campaign || !project) throw new AppError('not-found', 'Campaign not found');
    return { entityType: 'campaign', entityId: campaign.id, clientId: project.clientId, projectId: project.id, campaignId: campaign.id };
  }

  async function reachableProject(actor: ActorContext, projectId: string) {
    const project = await d.reach.projects.findReachable(actor, projectId);
    if (!project) throw new AppError('not-found', 'Project not found');
    return project;
  }

  async function change(actor: ActorContext, level: KpiLevel, next: KpiInput | null) {
    if (next?.metric === MANUAL_KPI) {
      throw new AppError('validation', 'Only a project KPI can be set by hand');
    }
    const owner = await ownerOf(actor, level);
    if (owner.entityType !== 'organization' && !can(actor, 'update', 'kpi')) {
      throw new AppError('forbidden', `Your role may not change a ${owner.entityType} KPI`);
    }
    const kpi = next && normalized(next, d.clock.now());
    const before = await d.kpis.read(owner);
    if (!before && !kpi) return null;
    await d.unitOfWork.run(async (context) => {
      await d.kpis.write(context, owner, kpi);
      await d.audit.append(context, {
        action: 'UPDATE', entityType: owner.entityType, entityId: owner.entityId,
        clientId: owner.clientId, projectId: owner.projectId, campaignId: owner.campaignId,
        summary: kpi ? `Set ${owner.entityType} KPI` : `Cleared ${owner.entityType} KPI`,
        changes: { before: snapshot(before), after: snapshot(kpi) },
      }, actor);
    });
    return kpi;
  }

  return {
    async read(actor: ActorContext, level: KpiLevel) {
      return d.kpis.read(await ownerOf(actor, level));
    },
    set(actor: ActorContext, level: KpiLevel, input: KpiInput) {
      return change(actor, level, input);
    },
    async clear(actor: ActorContext, level: KpiLevel) {
      await change(actor, level, null);
    },
    async listProject(actor: ActorContext, projectId: string) {
      await reachableProject(actor, projectId);
      return d.projectKpis.list(projectId);
    },
    async replaceProject(actor: ActorContext, projectId: string, inputs: readonly ProjectKpiInput[]) {
      const project = await reachableProject(actor, projectId);
      if (!can(actor, 'update', 'kpi')) throw new AppError('forbidden', 'Your role may not change a project KPI');
      if (inputs.length > MAX_PROJECT_KPIS) {
        throw new AppError('validation', `A project holds at most ${MAX_PROJECT_KPIS} KPIs`);
      }
      const now = d.clock.now();
      const next = inputs.map(({ enabled, ...input }) => ({ ...normalized(input, now), enabled }));
      const before = await d.projectKpis.list(projectId);
      if (before.length === 0 && next.length === 0) return [];
      await d.unitOfWork.run(async (context) => {
        await d.projectKpis.replace(context, projectId, next);
        await d.audit.append(context, {
          action: 'UPDATE', entityType: 'project', entityId: projectId,
          clientId: project.clientId, projectId, campaignId: null,
          summary: next.length > 0 ? 'Set project KPIs' : 'Cleared project KPIs',
          changes: {
            before: before.map(projectSnapshot),
            after: next.map(projectSnapshot),
          },
        }, actor);
      });
      if (next.length > 0) d.events.changed(projectId, actor);
      return d.projectKpis.list(projectId);
    },
  };
}
export type KpiUseCases = ReturnType<typeof createKpiUseCases>;
