import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import type { ImportJobs } from "../application/import-jobs.js";
import { MetaError, type Integration } from "../domain/integration.js";
import type { ImportedMetric, Snapshot } from "../domain/snapshot.js";
import { nextMorning } from "../application/schedule.js";

const leaseUntil = (now: Date) => new Date(now.getTime() + 180_000);
const owned = (job: Integration, now: Date) => ({ projectId: job.projectId, revision: job.revision, leaseOwner: job.leaseOwner, leaseUntil: { gt: now } });
const metricData = ({ date, externalId: _externalId, ...data }: ImportedMetric, now: Date) => ({ ...data, date: new Date(`${date}T00:00:00Z`), syncedAt: now });

export class PrismaImportJobs implements ImportJobs {
  constructor(private readonly prisma: PrismaClient) {}

  async claim(now: Date): Promise<Integration | null> {
    const available: Prisma.ProjectIntegrationWhereInput = {
      status: { not: "AUTH_REQUIRED" },
      AND: [
        { OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }] },
        { OR: [{ queuedAt: { lte: now } }, { queuedAt: null, nextDailyAt: { lte: now } }, { status: "RUNNING", leaseUntil: { lte: now } }] },
      ],
    };
    const candidate = await this.prisma.projectIntegration.findFirst({ where: available, orderBy: { nextDailyAt: "asc" } });
    if (!candidate) return null;
    const owner = randomUUID();
    const claimed = await this.prisma.projectIntegration.updateMany({ where: { ...available, projectId: candidate.projectId, revision: candidate.revision, leaseOwner: candidate.leaseOwner }, data: {
      status: "RUNNING", leaseOwner: owner, leaseUntil: leaseUntil(now), queuedAt: null,
      ...(candidate.nextDailyAt <= now ? { nextDailyAt: nextMorning(now) } : {}),
    } });
    if (!claimed.count) return null;
    return this.prisma.projectIntegration.findFirst({ where: { projectId: candidate.projectId, leaseOwner: owner } });
  }

  async renew(job: Integration, now: Date): Promise<boolean> {
    return (await this.prisma.projectIntegration.updateMany({ where: owned(job, now), data: { leaseUntil: leaseUntil(now) } })).count === 1;
  }

  async complete(job: Integration, snapshot: Snapshot, now: Date): Promise<boolean> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const locked = await tx.projectIntegration.updateMany({ where: owned(job, now), data: { leaseUntil: leaseUntil(now) } });
        if (!locked.count) return false;
        const projects = await tx.$queryRaw<Array<{ budget_currency: string }>>`SELECT budget_currency FROM project WHERE id = ${job.projectId} FOR UPDATE`;
        if (projects[0]?.budget_currency !== job.currency) throw new MetaError("CURRENCY");
        const campaignIds = new Map<string, string>();
        const adSetIds = new Map<string, string>();
        const adIds = new Map<string, string>();
        let campaignPosition = (await tx.campaign.aggregate({ where: { projectId: job.projectId }, _max: { position: true } }))._max.position ?? -1;
        for (const row of snapshot.campaigns) {
          if (campaignIds.has(row.id)) throw new MetaError("INVALID_DATA");
          const existing = await tx.campaign.findUnique({ where: { channel_externalId: { channel: "META", externalId: row.id } } });
          if (existing && existing.projectId !== job.projectId) throw new MetaError("CONFLICT");
          const data = { name: row.name, status: row.status, objective: row.objective ?? null };
          const saved = existing ? await tx.campaign.update({ where: { id: existing.id }, data }) : await tx.campaign.create({ data: { ...data, projectId: job.projectId, channel: "META", externalId: row.id, position: ++campaignPosition } });
          campaignIds.set(row.id, saved.id);
        }
        for (const row of snapshot.adSets) {
          const campaignId = campaignIds.get(row.parentId ?? "");
          if (!campaignId || adSetIds.has(row.id)) throw new MetaError("INVALID_DATA");
          const existing = await tx.adSet.findFirst({ where: { campaignId, externalId: row.id } });
          const data = { name: row.name, status: row.status };
          const position = existing?.position ?? ((await tx.adSet.aggregate({ where: { campaignId }, _max: { position: true } }))._max.position ?? -1) + 1;
          const saved = existing ? await tx.adSet.update({ where: { id: existing.id }, data }) : await tx.adSet.create({ data: { ...data, campaignId, externalId: row.id, position } });
          adSetIds.set(row.id, saved.id);
        }
        for (const row of snapshot.ads) {
          const adSetId = adSetIds.get(row.parentId ?? "");
          if (!adSetId || adIds.has(row.id)) throw new MetaError("INVALID_DATA");
          const existing = await tx.ad.findFirst({ where: { adSetId, externalId: row.id } });
          const data = { name: row.name, status: row.status };
          const position = existing?.position ?? ((await tx.ad.aggregate({ where: { adSetId }, _max: { position: true } }))._max.position ?? -1) + 1;
          const saved = existing ? await tx.ad.update({ where: { id: existing.id }, data }) : await tx.ad.create({ data: { ...data, adSetId, externalId: row.id, position } });
          adIds.set(row.id, saved.id);
        }
        const resolve = (ids: Map<string, string>, row: ImportedMetric) => {
          const id = ids.get(row.externalId);
          if (!id) throw new MetaError("INVALID_DATA");
          return id;
        };
        const campaignMetrics = snapshot.campaignMetrics.map((row) => ({ ...metricData(row, now), campaignId: resolve(campaignIds, row) }));
        const adSetMetrics = snapshot.adSetMetrics.map((row) => ({ ...metricData(row, now), adSetId: resolve(adSetIds, row) }));
        const adMetrics = snapshot.adMetrics.map((row) => ({ ...metricData(row, now), adId: resolve(adIds, row) }));
        const date = { gte: new Date(`${snapshot.from}T00:00:00Z`), lte: new Date(`${snapshot.to}T00:00:00Z`) };
        await tx.campaignDailyMetric.deleteMany({ where: { campaignId: { in: [...campaignIds.values()] }, date } });
        await tx.adSetDailyMetric.deleteMany({ where: { adSetId: { in: [...adSetIds.values()] }, date } });
        await tx.adDailyMetric.deleteMany({ where: { adId: { in: [...adIds.values()] }, date } });
        for (let i = 0; i < campaignMetrics.length; i += 1000) await tx.campaignDailyMetric.createMany({ data: campaignMetrics.slice(i, i + 1000) });
        for (let i = 0; i < adSetMetrics.length; i += 1000) await tx.adSetDailyMetric.createMany({ data: adSetMetrics.slice(i, i + 1000) });
        for (let i = 0; i < adMetrics.length; i += 1000) await tx.adDailyMetric.createMany({ data: adMetrics.slice(i, i + 1000) });
        await tx.projectIntegration.update({ where: { projectId: job.projectId }, data: { status: "SUCCESS", lastSuccessAt: now, lastError: null, retryCount: 0, leaseOwner: null, leaseUntil: null } });
        return true;
      }, { timeout: 60_000 });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new MetaError("CONFLICT");
      throw error;
    }
  }

  async fail(job: Integration, error: MetaError, now: Date): Promise<void> {
    const delays = [60_000, 300_000, 900_000];
    const retry = error.code === "PROVIDER" && job.retryCount < delays.length;
    await this.prisma.projectIntegration.updateMany({ where: owned(job, now), data: {
      status: error.code === "TOKEN" ? "AUTH_REQUIRED" : retry ? "QUEUED" : "ERROR",
      lastError: error.code, leaseOwner: null, leaseUntil: null,
      queuedAt: retry ? new Date(now.getTime() + Math.max(delays[job.retryCount], error.retryAfterMs)) : null,
      retryCount: retry ? job.retryCount + 1 : 0,
    } });
  }
}
