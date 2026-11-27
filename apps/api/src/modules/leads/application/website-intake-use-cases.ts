import { randomBytes } from 'node:crypto';
import { can, type Action } from '@adpulse/access-policy';
import { AppError } from '#shared/domain/index.js';
import type { ActorContext, IdGenerator, TransactionContext, UnitOfWork } from '#shared/application/index.js';
import type { AuditWriter } from '#modules/audit/index.js';
import { WEBSITE_SITE_LIMIT, hostOf, siteAllowed, type LiveWebsiteKey, type WebsiteKey, type WebsiteLead } from '../domain/website-intake.js';
import type { LeadIntake } from './lead-intake.js';

export const WEBSITE_KEY_REFUSED = 'The website key is not valid for this site';

export interface WebsiteKeyRepository {
  find(projectId: string, context?: TransactionContext): Promise<WebsiteKey | null>;
  create(context: TransactionContext, input: { id: string; projectId: string; key: string }): Promise<WebsiteKey>;
  rotate(context: TransactionContext, projectId: string, key: string): Promise<WebsiteKey>;
  setSites(context: TransactionContext, projectId: string, sites: string[]): Promise<WebsiteKey>;
  remove(context: TransactionContext, projectId: string): Promise<void>;
  findLive(key: string): Promise<LiveWebsiteKey | null>;
}

export interface WebsiteProjectReach {
  findReachable(actor: ActorContext, id: string): Promise<{ id: string; clientId: string; name: string } | null>;
}

export interface WebsiteKeySource {
  issue(): string;
}

export class RandomWebsiteKeys implements WebsiteKeySource {
  issue(): string {
    return `bk_${randomBytes(24).toString('base64url')}`;
  }
}

export interface ReceivedWebsiteLead {
  key: string;
  origin: string | undefined;
  lead: WebsiteLead;
  campaignId?: string;
}

export function createWebsiteIntakeUseCases(d: {
  keys: WebsiteKeyRepository;
  projects: WebsiteProjectReach;
  tokens: WebsiteKeySource;
  intake: LeadIntake;
  ids: IdGenerator;
  audit: AuditWriter;
  unitOfWork: UnitOfWork;
  clock: { now(): Date };
}) {
  const projectFor = async (actor: ActorContext, projectId: string, action: Action) => {
    const project = await d.projects.findReachable(actor, projectId);
    if (!project) throw new AppError('not-found', 'Project not found');
    if (!can(actor, action, 'lead-intake-key')) throw new AppError('forbidden', "Your role may not manage a project's website key");
    return project;
  };
  const record = (context: TransactionContext, actor: ActorContext, project: { id: string; clientId: string; name: string }, summary: string, change: string) =>
    d.audit.append(context, { action: 'UPDATE', entityType: 'project', entityId: project.id, clientId: project.clientId, projectId: project.id, summary, changes: { websiteKey: change } }, actor);

  return {
    async read(actor: ActorContext, projectId: string): Promise<WebsiteKey | null> {
      const project = await projectFor(actor, projectId, 'read');
      return d.keys.find(project.id);
    },

    async create(actor: ActorContext, projectId: string): Promise<WebsiteKey> {
      const project = await projectFor(actor, projectId, 'create');
      return d.unitOfWork.run(async (context) => {
        const existing = await d.keys.find(project.id, context);
        if (existing) return existing;
        const created = await d.keys.create(context, { id: d.ids.generate(), projectId: project.id, key: d.tokens.issue() });
        await record(context, actor, project, `Created a website key for project “${project.name}”`, 'created');
        return created;
      });
    },

    async rotate(actor: ActorContext, projectId: string): Promise<WebsiteKey> {
      const project = await projectFor(actor, projectId, 'update');
      return d.unitOfWork.run(async (context) => {
        if (!(await d.keys.find(project.id, context))) throw new AppError('not-found', 'Website key not found');
        const rotated = await d.keys.rotate(context, project.id, d.tokens.issue());
        await record(context, actor, project, `Replaced the website key of project “${project.name}”`, 'replaced');
        return rotated;
      });
    },

    async allowSites(actor: ActorContext, projectId: string, sites: readonly string[]): Promise<WebsiteKey> {
      const project = await projectFor(actor, projectId, 'update');
      const hosts = [...new Set(sites.map((site) => hostOf(site)))];
      if (hosts.includes(null)) throw new AppError('validation', 'A site must be a valid host name');
      if (hosts.length > WEBSITE_SITE_LIMIT) throw new AppError('validation', `A key allows at most ${WEBSITE_SITE_LIMIT} sites`);
      return d.unitOfWork.run(async (context) => {
        if (!(await d.keys.find(project.id, context))) throw new AppError('not-found', 'Website key not found');
        const updated = await d.keys.setSites(context, project.id, hosts as string[]);
        await record(context, actor, project, `Changed the sites allowed to send leads to project “${project.name}”`, 'sites');
        return updated;
      });
    },

    async remove(actor: ActorContext, projectId: string): Promise<void> {
      const project = await projectFor(actor, projectId, 'delete');
      await d.unitOfWork.run(async (context) => {
        if (!(await d.keys.find(project.id, context))) throw new AppError('not-found', 'Website key not found');
        await d.keys.remove(context, project.id);
        await record(context, actor, project, `Removed the website key of project “${project.name}”`, 'removed');
      });
    },

    async originAllowed(key: string, origin: string | undefined): Promise<boolean> {
      const live = await d.keys.findLive(key);
      return live !== null && siteAllowed(live.allowedSites, origin);
    },

    async receive({ key, origin, lead, campaignId }: ReceivedWebsiteLead, serverToServer: boolean): Promise<void> {
      const live = await d.keys.findLive(key);
      if (!live || (origin !== undefined ? !siteAllowed(live.allowedSites, origin) : !serverToServer)) {
        throw new AppError('forbidden', WEBSITE_KEY_REFUSED);
      }
      const target = { orgId: live.orgId, projectId: live.projectId };
      const { created } = await d.unitOfWork.run((context) => d.intake.deliverWebsite(context, { ...target, lead, campaignId, submittedAt: d.clock.now() }));
      if (created) d.intake.announce(target);
    },
  };
}

export type WebsiteIntakeUseCases = ReturnType<typeof createWebsiteIntakeUseCases>;
