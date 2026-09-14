import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { TransactionContext } from "#shared/application/index.js";
import type { PrismaUnitOfWork } from "#shared/infrastructure/prisma-unit-of-work.js";
import { LEAD_ACCESS_RETRY_MS, LEAD_POLL_INTERVAL_MS, type LeadPollJobs, type LeadPollOutcome } from "../application/lead-poll-jobs.js";
import type { LeadPollJob, MetaError } from "../domain/integration.js";
import type { PolledAd } from "../domain/snapshot.js";

const leaseUntil = (now: Date) => new Date(now.getTime() + 180_000);
const owned = (job: LeadPollJob, now: Date): Prisma.ProjectIntegrationWhereInput => ({
  projectId: job.projectId, revision: job.revision, leadsLeaseOwner: job.leadsLeaseOwner, leadsLeaseUntil: { gt: now },
});
const released = { leadsLeaseOwner: null, leadsLeaseUntil: null };

export class PrismaLeadPollJobs implements LeadPollJobs {
  constructor(private readonly prisma: PrismaClient, private readonly unitOfWork: PrismaUnitOfWork<Prisma.TransactionClient>) {}

  async claim(now: Date): Promise<LeadPollJob | null> {
    const available: Prisma.ProjectIntegrationWhereInput = {
      status: { not: "AUTH_REQUIRED" },
      lastSuccessAt: { not: null },
      AND: [
        { OR: [{ leadsLeaseUntil: null }, { leadsLeaseUntil: { lte: now } }] },
        { OR: [{ nextLeadsAt: { lte: now } }, { leadsQueuedAt: { lte: now } }, { nextSweepAt: { lte: now } }] },
      ],
    };
    const candidate = await this.prisma.projectIntegration.findFirst({ where: available, orderBy: { nextLeadsAt: "asc" } });
    if (!candidate) return null;
    const owner = randomUUID();
    const claimed = await this.prisma.projectIntegration.updateMany({
      where: { ...available, projectId: candidate.projectId, revision: candidate.revision, leadsLeaseOwner: candidate.leadsLeaseOwner },
      data: { leadsLeaseOwner: owner, leadsLeaseUntil: leaseUntil(now) },
    });
    if (!claimed.count) return null;
    const row = await this.prisma.projectIntegration.findFirst({
      where: { projectId: candidate.projectId, leadsLeaseOwner: owner },
      include: { project: { select: { clientId: true, client: { select: { orgId: true } } } } },
    });
    if (!row) return null;
    const { project, ...integration } = row;
    const due = (moment: Date | null) => moment !== null && moment <= now;
    return {
      ...integration, clientId: project.clientId, orgId: project.client.orgId,
      pollDue: due(integration.nextLeadsAt) || due(integration.leadsQueuedAt),
      sweepDue: due(integration.nextSweepAt),
    };
  }

  async renew(job: LeadPollJob, now: Date): Promise<boolean> {
    return (await this.prisma.projectIntegration.updateMany({ where: owned(job, now), data: { leadsLeaseUntil: leaseUntil(now) } })).count === 1;
  }

  async sweepAds(job: LeadPollJob, since: Date): Promise<PolledAd[]> {
    const ads = await this.prisma.ad.findMany({
      where: {
        externalId: { not: null },
        adSet: { externalId: { not: null }, campaign: { projectId: job.projectId, channel: "META", externalId: { not: null } } },
        metrics: { some: { date: { gte: new Date(`${since.toISOString().slice(0, 10)}T00:00:00Z`) }, conversions: { gt: 0 } } },
      },
      select: { externalId: true, name: true, adSet: { select: { externalId: true, name: true, campaign: { select: { externalId: true, name: true } } } } },
      orderBy: { externalId: "asc" },
    });
    return ads.map((ad) => ({
      adId: ad.externalId!, adName: ad.name,
      adSet: { externalId: ad.adSet.externalId!, name: ad.adSet.name },
      campaign: { externalId: ad.adSet.campaign.externalId!, name: ad.adSet.campaign.name },
    }));
  }

  async hold(context: TransactionContext, job: LeadPollJob, now: Date): Promise<boolean> {
    const client = this.unitOfWork.clientFor(context);
    return (await client.projectIntegration.updateMany({ where: owned(job, now), data: { leadsLeaseUntil: leaseUntil(now) } })).count === 1;
  }

  async succeed(context: TransactionContext, job: LeadPollJob, outcome: LeadPollOutcome, now: Date): Promise<void> {
    const client = this.unitOfWork.clientFor(context);
    await client.projectIntegration.update({
      where: { projectId: job.projectId },
      data: {
        ...released, leadsStatus: "OK", leadsLastSuccessAt: now, leadsLastError: null,
        ...(outcome.polled ? { leadsCoveredUntil: outcome.coveredUntil, nextLeadsAt: new Date(now.getTime() + LEAD_POLL_INTERVAL_MS), leadsQueuedAt: null } : {}),
      },
    });
    if (outcome.swept) {
      await client.projectIntegration.updateMany({ where: { projectId: job.projectId, nextSweepAt: job.nextSweepAt }, data: { nextSweepAt: null } });
    }
  }

  async fail(job: LeadPollJob, error: MetaError, now: Date): Promise<void> {
    const later = (delay: number) => new Date(now.getTime() + delay);
    const deferred = (delay: number) => ({
      nextLeadsAt: later(delay), leadsQueuedAt: null,
      ...(job.nextSweepAt ? { nextSweepAt: later(delay) } : {}),
    });
    const data: Prisma.ProjectIntegrationUpdateManyMutationInput = error.code === "TOKEN"
      ? { ...released, status: "AUTH_REQUIRED", lastError: "TOKEN", leadsLastError: "TOKEN" }
      : error.code === "ACCESS"
        ? { ...released, ...deferred(LEAD_ACCESS_RETRY_MS), leadsStatus: "ACCESS_REQUIRED", leadsLastError: "ACCESS" }
        : { ...released, ...deferred(Math.max(LEAD_POLL_INTERVAL_MS, error.retryAfterMs)), leadsStatus: "ERROR", leadsLastError: error.code };
    await this.prisma.projectIntegration.updateMany({ where: owned(job, now), data });
  }
}
