import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { CheckJobs, CheckResult } from "../application/ports.js";
import type { SeoSite } from "../domain/seo-site.js";

const LEASE_MS = 180_000;
const WEEK_MS = 7 * 86_400_000;
const RETRY_MS = 86_400_000;
const IMPRESSION_PAGES = 1000;

const leaseUntil = (now: Date) => new Date(now.getTime() + LEASE_MS);
const owned = (job: SeoSite, now: Date): Prisma.SeoSiteWhereInput => ({ id: job.id, checkLeaseOwner: job.checkLeaseOwner, checkLeaseUntil: { gt: now } });

export class PrismaCheckJobs implements CheckJobs {
  constructor(private readonly prisma: PrismaClient) {}

  async claim(now: Date): Promise<SeoSite | null> {
    const available: Prisma.SeoSiteWhereInput = {
      AND: [
        { OR: [{ checkLeaseUntil: null }, { checkLeaseUntil: { lte: now } }] },
        { OR: [{ checkQueuedAt: { lte: now } }, { checkQueuedAt: null, nextCheckAt: { lte: now } }, { checkStatus: "RUNNING", checkLeaseUntil: { lte: now } }] },
      ],
    };
    const candidate = await this.prisma.seoSite.findFirst({ where: available, orderBy: { nextCheckAt: "asc" } });
    if (!candidate) return null;
    const owner = randomUUID();
    const claimed = await this.prisma.seoSite.updateMany({
      where: { ...available, id: candidate.id, checkLeaseOwner: candidate.checkLeaseOwner },
      data: { checkStatus: "RUNNING", checkLeaseOwner: owner, checkLeaseUntil: leaseUntil(now), checkQueuedAt: null },
    });
    if (!claimed.count) return null;
    return this.prisma.seoSite.findFirst({ where: { id: candidate.id, checkLeaseOwner: owner } });
  }

  async renew(job: SeoSite, now: Date): Promise<boolean> {
    return (await this.prisma.seoSite.updateMany({ where: owned(job, now), data: { checkLeaseUntil: leaseUntil(now) } })).count === 1;
  }

  async impressionPages(siteId: string, from: string): Promise<string[]> {
    const rows = await this.prisma.seoPageDay.groupBy({
      by: ["page"],
      where: { siteId, date: { gte: new Date(`${from}T00:00:00Z`) }, impressions: { gt: 0 } },
      _sum: { impressions: true },
      orderBy: { _sum: { impressions: "desc" } },
      take: IMPRESSION_PAGES,
    });
    return rows.map((row) => row.page);
  }

  async complete(job: SeoSite, result: CheckResult, now: Date): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.seoSite.updateMany({ where: owned(job, now), data: { checkLeaseUntil: leaseUntil(now) } });
      if (!locked.count) return false;
      await tx.seoAudit.deleteMany({ where: { siteId: job.id } });
      const audit = await tx.seoAudit.create({ data: { siteId: job.id, finishedAt: now, checked: result.pages.length, notChecked: result.notChecked } });
      await tx.seoAuditPage.createMany({
        data: result.pages.map((page) => ({
          auditId: audit.id,
          url: page.url,
          status: page.status,
          finalUrl: page.finalUrl,
          contentType: page.contentType,
          responseMs: page.responseMs,
          inSitemap: page.inSitemap,
          hasImpressions: page.hasImpressions,
          facts: { outcome: page.outcome, ...(page.facts ?? {}) } as unknown as Prisma.InputJsonValue,
          problems: [...(result.problems.get(page.url) ?? [])],
        })),
        skipDuplicates: true,
      });
      for (const lab of result.labs) {
        const { device, ...figures } = lab;
        await tx.seoLab.upsert({
          where: { siteId_device: { siteId: job.id, device } },
          create: { siteId: job.id, device, measuredAt: now, ...figures },
          update: { measuredAt: now, ...figures },
        });
      }
      await tx.seoSite.update({ where: { id: job.id }, data: {
        checkStatus: "SUCCESS", lastCheckAt: now, checkError: null, nextCheckAt: new Date(now.getTime() + WEEK_MS),
        checkLeaseOwner: null, checkLeaseUntil: null,
      } });
      return true;
    }, { timeout: 60_000 });
  }

  async fail(job: SeoSite, code: string, now: Date): Promise<void> {
    await this.prisma.seoSite.updateMany({ where: owned(job, now), data: {
      checkStatus: "ERROR", checkError: code, nextCheckAt: new Date(now.getTime() + RETRY_MS), checkLeaseOwner: null, checkLeaseUntil: null,
    } });
  }
}
