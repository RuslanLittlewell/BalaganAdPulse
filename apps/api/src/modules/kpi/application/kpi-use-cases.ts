import { can } from '@adpulse/access-policy';
import { AppError } from '#shared/domain/index.js';
import type { ActorContext, UnitOfWork } from '#shared/application/index.js';
import type { AuditWriter } from '../../audit/index.js';
import { normalizeTarget, type Kpi, type KpiInput, type KpiLevel, type KpiOwner } from '../domain/kpi.js';
import type { KpiReach, KpiRepository } from './ports.js';

const snapshot = (kpi: Kpi | null) => kpi && { metric: kpi.metric, target: kpi.target };

export function createKpiUseCases(d: { kpis: KpiRepository; reach: KpiReach; audit: AuditWriter; unitOfWork: UnitOfWork; clock: { now(): Date } }) {
  async function ownerOf(actor: ActorContext, level: KpiLevel): Promise<KpiOwner> {
    if (level.kind === 'organization') {
      if (!can(actor, 'update', 'organization')) throw new AppError('forbidden', 'Your role may not manage the organization KPI');
      return { entityType: 'organization', entityId: actor.orgId, clientId: null, projectId: null, campaignId: null };
    }
    if (level.kind === 'project') {
      const project = await d.reach.projects.findReachable(actor, level.id);
      if (!project) throw new AppError('not-found', 'Project not found');
      return { entityType: 'project', entityId: project.id, clientId: project.clientId, projectId: project.id, campaignId: null };
    }
    const campaign = await d.reach.campaigns.findReachable(actor, level.id);
    const project = campaign && await d.reach.projects.findReachable(actor, campaign.projectId);
    if (!campaign || !project) throw new AppError('not-found', 'Campaign not found');
    return { entityType: 'campaign', entityId: campaign.id, clientId: project.clientId, projectId: project.id, campaignId: campaign.id };
  }

  async function change(actor: ActorContext, level: KpiLevel, next: KpiInput | null) {
    const owner = await ownerOf(actor, level);
    if (owner.entityType !== 'organization' && !can(actor, 'update', owner.entityType)) {
      throw new AppError('forbidden', `Your role may not change a ${owner.entityType} KPI`);
    }
    const kpi = next && { metric: next.metric, target: normalizeTarget(next.target), updatedAt: d.clock.now() };
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
  };
}
export type KpiUseCases = ReturnType<typeof createKpiUseCases>;
