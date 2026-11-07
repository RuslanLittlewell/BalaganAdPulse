import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { nextMorning } from "#shared/application/index.js";
import type { ImportJobs } from "../application/ports.js";
import type { SeoSite } from "../domain/seo-site.js";
import { shiftDate, TOP_DAYS, type SearchSnapshot } from "../domain/search.js";
import type { VitalsSnapshot } from "../domain/vitals.js";

const LEASE_MS = 180_000;
const RETRY_DELAYS = [60_000, 300_000, 900_000];
const CHUNK = 1000;

const leaseUntil = (now: Date) => new Date(now.getTime() + LEASE_MS);
const day = (date: string) => new Date(`${date}T00:00:00Z`);
const owned = (job: SeoSite, now: Date): Prisma.SeoSiteWhereInput => ({ id: job.id, revision: job.revision, leaseOwner: job.leaseOwner, leaseUntil: { gt: now } });

async function inChunks<T>(rows: readonly T[], write: (chunk: T[]) => Promise<unknown>) {
  for (let start = 0; start < rows.length; start += CHUNK) await write(rows.slice(start, start + CHUNK));
}

export class PrismaImportJobs implements ImportJobs {
  constructor(private readonly prisma: PrismaClient) {}

  async claim(now: Date): Promise<SeoSite | null> {
    const available: Prisma.SeoSiteWhereInput = {
      AND: [
        { OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }] },
        { OR: [{ queuedAt: { lte: now } }, { queuedAt: null, nextDailyAt: { lte: now } }, { status: "RUNNING", leaseUntil: { lte: now } }] },
      ],
    };
    const candidate = await this.prisma.seoSite.findFirst({ where: available, orderBy: { nextDailyAt: "asc" } });
    if (!candidate) return null;
    const owner = randomUUID();
    const claimed = await this.prisma.seoSite.updateMany({
      where: { ...available, id: candidate.id, revision: candidate.revision, leaseOwner: candidate.leaseOwner },
      data: {
        status: candidate.status === "AUTH_REQUIRED" ? "AUTH_REQUIRED" : "RUNNING",
        leaseOwner: owner,
        leaseUntil: leaseUntil(now),
        queuedAt: null,
        ...(candidate.nextDailyAt <= now ? { nextDailyAt: nextMorning(now) } : {}),
      },
    });
    if (!claimed.count) return null;
    return this.prisma.seoSite.findFirst({ where: { id: candidate.id, leaseOwner: owner } });
  }

  async renew(job: SeoSite, now: Date): Promise<boolean> {
    return (await this.prisma.seoSite.updateMany({ where: owned(job, now), data: { leaseUntil: leaseUntil(now) } })).count === 1;
  }

  async saveVitals(job: SeoSite, origin: string, vitals: VitalsSnapshot, now: Date): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.seoSite.updateMany({ where: owned(job, now), data: { origin, vitalsReadAt: now, leaseUntil: leaseUntil(now) } });
      if (!locked.count) return false;
      await tx.seoVital.deleteMany({ where: { siteId: job.id } });
      await tx.seoVital.createMany({ data: vitals.readings.map((reading) => ({ ...reading, siteId: job.id, periodEnd: day(reading.periodEnd) })) });
      const replaced = [...new Set(vitals.weeks.map((week) => week.periodEnd))].map(day);
      await tx.seoVitalWeek.deleteMany({ where: { siteId: job.id, periodEnd: { in: replaced } } });
      await tx.seoVitalWeek.createMany({ data: vitals.weeks.map((week) => ({ ...week, siteId: job.id, periodEnd: day(week.periodEnd) })), skipDuplicates: true });
      return true;
    });
  }

  async complete(job: SeoSite, snapshot: SearchSnapshot, now: Date): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.seoSite.updateMany({ where: owned(job, now), data: { leaseUntil: leaseUntil(now) } });
      if (!locked.count) return false;
      const siteId = job.id;
      const range = { gte: day(snapshot.from), lte: day(snapshot.to) };
      const topRange = { gte: day(snapshot.topFrom), lte: day(snapshot.to) };
      await tx.seoDay.deleteMany({ where: { siteId, date: range } });
      await tx.seoDay.createMany({ data: snapshot.days.map(({ date, ...figures }) => ({ ...figures, siteId, date: day(date) })), skipDuplicates: true });
      await tx.seoQueryDay.deleteMany({ where: { siteId, date: topRange } });
      await tx.seoPageDay.deleteMany({ where: { siteId, date: topRange } });
      const queries = snapshot.queries.map(({ date, key, ...figures }) => ({ ...figures, siteId, date: day(date), query: key }));
      const pages = snapshot.pages.map(({ date, key, ...figures }) => ({ ...figures, siteId, date: day(date), page: key }));
      await inChunks(queries, (chunk) => tx.seoQueryDay.createMany({ data: chunk, skipDuplicates: true }));
      await inChunks(pages, (chunk) => tx.seoPageDay.createMany({ data: chunk, skipDuplicates: true }));
      const kept = { lt: day(shiftDate(snapshot.to, -(TOP_DAYS - 1))) };
      await tx.seoQueryDay.deleteMany({ where: { siteId, date: kept } });
      await tx.seoPageDay.deleteMany({ where: { siteId, date: kept } });
      await tx.seoSite.update({ where: { id: siteId }, data: {
        status: "SUCCESS", lastSuccessAt: now, lastError: null, retryCount: 0, leaseOwner: null, leaseUntil: null,
      } });
      return true;
    }, { timeout: 120_000 });
  }

  async release(job: SeoSite, now: Date): Promise<void> {
    await this.prisma.seoSite.updateMany({ where: owned(job, now), data: { leaseOwner: null, leaseUntil: null } });
  }

  async fail(job: SeoSite, code: string, retryAfterMs: number, now: Date): Promise<void> {
    const retry = code === "PROVIDER" && job.retryCount < RETRY_DELAYS.length;
    await this.prisma.seoSite.updateMany({ where: owned(job, now), data: {
      status: code === "TOKEN" ? "AUTH_REQUIRED" : retry ? "QUEUED" : "ERROR",
      lastError: code,
      leaseOwner: null,
      leaseUntil: null,
      queuedAt: retry ? new Date(now.getTime() + Math.max(RETRY_DELAYS[job.retryCount]!, retryAfterMs)) : null,
      retryCount: retry ? job.retryCount + 1 : 0,
    } });
  }
}
