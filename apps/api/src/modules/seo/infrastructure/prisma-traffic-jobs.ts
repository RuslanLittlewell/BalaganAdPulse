import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { nextMorning } from "#shared/application/index.js";
import type { TrafficJobs } from "../application/ports.js";
import type { SeoSite } from "../domain/seo-site.js";
import { shiftDate } from "../domain/search.js";
import { TRAFFIC_DAYS, type TrafficSnapshot } from "../domain/traffic.js";

const LEASE_MS = 180_000;
const RETRY_DELAYS = [60_000, 300_000, 900_000];
const CHUNK = 1000;

const leaseUntil = (now: Date) => new Date(now.getTime() + LEASE_MS);
const day = (date: string) => new Date(`${date}T00:00:00Z`);
const owned = (job: SeoSite, now: Date): Prisma.SeoSiteWhereInput => ({
  id: job.id,
  revision: job.revision,
  analyticsPropertyId: job.analyticsPropertyId,
  trafficLeaseOwner: job.trafficLeaseOwner,
  trafficLeaseUntil: { gt: now },
});

export class PrismaTrafficJobs implements TrafficJobs {
  constructor(private readonly prisma: PrismaClient) {}

  async claim(now: Date): Promise<SeoSite | null> {
    const available: Prisma.SeoSiteWhereInput = {
      analyticsPropertyId: { not: null },
      AND: [
        { OR: [{ trafficLeaseUntil: null }, { trafficLeaseUntil: { lte: now } }] },
        {
          OR: [
            { trafficQueuedAt: { lte: now } },
            { trafficQueuedAt: null, trafficStatus: { not: "AUTH_REQUIRED" }, nextTrafficAt: { lte: now } },
            { trafficStatus: "RUNNING", trafficLeaseUntil: { lte: now } },
          ],
        },
      ],
    };
    const candidate = await this.prisma.seoSite.findFirst({ where: available, orderBy: { nextTrafficAt: "asc" } });
    if (!candidate) return null;
    const owner = randomUUID();
    const claimed = await this.prisma.seoSite.updateMany({
      where: { ...available, id: candidate.id, revision: candidate.revision, trafficLeaseOwner: candidate.trafficLeaseOwner },
      data: {
        trafficStatus: "RUNNING",
        trafficLeaseOwner: owner,
        trafficLeaseUntil: leaseUntil(now),
        trafficQueuedAt: null,
        ...(candidate.nextTrafficAt !== null && candidate.nextTrafficAt <= now ? { nextTrafficAt: nextMorning(now) } : {}),
      },
    });
    if (!claimed.count) return null;
    return this.prisma.seoSite.findFirst({ where: { id: candidate.id, trafficLeaseOwner: owner } });
  }

  async renew(job: SeoSite, now: Date): Promise<boolean> {
    return (await this.prisma.seoSite.updateMany({ where: owned(job, now), data: { trafficLeaseUntil: leaseUntil(now) } })).count === 1;
  }

  async complete(job: SeoSite, snapshot: TrafficSnapshot, now: Date): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.seoSite.updateMany({ where: owned(job, now), data: { trafficLeaseUntil: leaseUntil(now) } });
      if (!locked.count) return false;
      const siteId = job.id;
      await tx.seoTrafficDay.deleteMany({ where: { siteId, date: { gte: day(snapshot.from), lte: day(snapshot.to) } } });
      const rows = snapshot.rows.map(({ date, ...figures }) => ({ ...figures, siteId, date: day(date) }));
      for (let start = 0; start < rows.length; start += CHUNK) {
        await tx.seoTrafficDay.createMany({ data: rows.slice(start, start + CHUNK), skipDuplicates: true });
      }
      await tx.seoTrafficDay.deleteMany({ where: { siteId, date: { lt: day(shiftDate(snapshot.to, -(TRAFFIC_DAYS - 1))) } } });
      await tx.seoSite.update({ where: { id: siteId }, data: {
        trafficStatus: "SUCCESS", trafficSuccessAt: now, trafficError: null, trafficRetryCount: 0, trafficLeaseOwner: null, trafficLeaseUntil: null,
      } });
      return true;
    }, { timeout: 120_000 });
  }

  async release(job: SeoSite, now: Date): Promise<void> {
    await this.prisma.seoSite.updateMany({ where: owned(job, now), data: { trafficLeaseOwner: null, trafficLeaseUntil: null } });
  }

  async fail(job: SeoSite, code: string, retryAfterMs: number, now: Date): Promise<void> {
    const retry = code === "PROVIDER" && job.trafficRetryCount < RETRY_DELAYS.length;
    await this.prisma.seoSite.updateMany({ where: owned(job, now), data: {
      trafficStatus: code === "TOKEN" ? "AUTH_REQUIRED" : retry ? "QUEUED" : "ERROR",
      trafficError: code,
      trafficLeaseOwner: null,
      trafficLeaseUntil: null,
      trafficQueuedAt: retry ? new Date(now.getTime() + Math.max(RETRY_DELAYS[job.trafficRetryCount]!, retryAfterMs)) : null,
      trafficRetryCount: retry ? job.trafficRetryCount + 1 : 0,
    } });
  }
}
