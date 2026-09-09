import { beforeEach, expect, it } from "vitest";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedProject, seedCampaign } from "../helpers/db.js";
import { signInAs } from "../helpers/auth.js";
import { PrismaImportJobs } from "../../src/modules/integrations/infrastructure/prisma-import-jobs.js";
import { MetaError } from "../../src/modules/integrations/domain/integration.js";
import type { Snapshot } from "../../src/modules/integrations/domain/snapshot.js";
const now = new Date("2026-09-08T06:00:00Z");
const jobs = new PrismaImportJobs(prisma);
let projectId: string;
const snapshot = (): Snapshot => ({
  from: "2026-08-09", to: "2026-09-07",
  campaigns: [{ id: "101", name: "Campaign", status: "ACTIVE" }],
  adSets: [{ id: "102", parentId: "101", name: "Set", status: "PAUSED" }],
  ads: [{ id: "103", parentId: "102", name: "Ad", status: "LEARNING" }],
  campaignMetrics: [{ externalId: "101", date: "2026-09-07", spend: "12.3456", impressions: 30, reach: 20, clicks: 3, conversions: 1, revenue: "20.0000" }],
  adSetMetrics: [{ externalId: "102", date: "2026-09-07", spend: "12.3456", impressions: 30, reach: 20, clicks: 3, conversions: 1, revenue: "20.0000" }],
  adMetrics: [{ externalId: "103", date: "2026-09-07", spend: "12.3456", impressions: 30, reach: 20, clicks: 3, conversions: 1, revenue: "20.0000" }],
});
beforeEach(async () => {
  await resetDb();
  const user = await signInAs();
  ({ projectId } = await seedProject(user.user.id));
  await prisma.projectIntegration.create({ data: { projectId, accountId: "123", currency: "BYN", timezone: "UTC", encryptedToken: "encrypted", revision: "v1", nextDailyAt: now, queuedAt: now } });
});
it("claims once across workers and recovers an expired lease with fencing", async () => {
  const claims = await Promise.all([jobs.claim(now), jobs.claim(now)]);
  expect(claims.filter(Boolean)).toHaveLength(1);
  const first = claims.find(Boolean)!;
  const later = new Date(now.getTime() + 180_001);
  const second = await jobs.claim(later);
  expect(second).not.toBeNull();
  expect(second!.leaseOwner).not.toBe(first.leaseOwner);
  expect(await jobs.complete(first, snapshot(), later)).toBe(false);
  expect(await jobs.complete(second!, snapshot(), later)).toBe(true);
});
it("imports the full hierarchy repeatedly, replaces corrected days and preserves manual and older data", async () => {
  const manual = await seedCampaign(projectId);
  let job = (await jobs.claim(now))!;
  expect(await jobs.complete(job, snapshot(), now)).toBe(true);
  const campaign = await prisma.campaign.findFirstOrThrow({ where: { externalId: "101" } });
  await prisma.campaignDailyMetric.create({ data: { campaignId: campaign.id, date: new Date("2026-01-01"), spend: "99" } });
  await prisma.campaignDailyMetric.create({ data: { campaignId: manual.id, date: new Date("2026-09-07"), spend: "50" } });
  await prisma.projectIntegration.update({ where: { projectId }, data: { queuedAt: now, status: "QUEUED" } });
  job = (await jobs.claim(now))!;
  const changed = snapshot();
  changed.campaignMetrics[0].spend = "13.4567";
  expect(await jobs.complete(job, changed, now)).toBe(true);
  expect(await prisma.campaign.count()).toBe(2);
  expect(await prisma.adSet.count()).toBe(1);
  expect(await prisma.ad.count()).toBe(1);
  expect(String((await prisma.campaignDailyMetric.findUniqueOrThrow({ where: { campaignId_date: { campaignId: campaign.id, date: new Date("2026-09-07") } } })).spend)).toBe("13.4567");
  expect(await prisma.campaignDailyMetric.count()).toBe(3);
  await prisma.projectIntegration.update({ where: { projectId }, data: { queuedAt: now, status: "QUEUED" } });
  job = (await jobs.claim(now))!;
  changed.campaignMetrics = [];
  await jobs.complete(job, changed, now);
  expect(await prisma.campaignDailyMetric.count()).toBe(2);
});
it("rolls back all changes on foreign external IDs or invalid hierarchy", async () => {
  const other = await seedProject("unused", "Other");
  await prisma.campaign.create({ data: { projectId: other.projectId, name: "Private", channel: "META", externalId: "101", position: 0 } });
  const job = (await jobs.claim(now))!;
  await expect(jobs.complete(job, snapshot(), now)).rejects.toMatchObject({ code: "CONFLICT" });
  expect(await prisma.campaign.count({ where: { projectId } })).toBe(0);
  await prisma.campaign.deleteMany();
  const invalid = snapshot();
  invalid.ads[0].parentId = "missing";
  await expect(jobs.complete(job, invalid, now)).rejects.toMatchObject({ code: "INVALID_DATA" });
  expect(await prisma.campaign.count()).toBe(0);
});
it("does not commit after replacement, disconnect, or currency changes", async () => {
  const job = (await jobs.claim(now))!;
  await prisma.projectIntegration.update({ where: { projectId }, data: { revision: "new" } });
  expect(await jobs.complete(job, snapshot(), now)).toBe(false);
  await prisma.projectIntegration.update({ where: { projectId }, data: { revision: job.revision } });
  await prisma.project.update({ where: { id: projectId }, data: { budgetCurrency: "USD" } });
  await expect(jobs.complete(job, snapshot(), now)).rejects.toMatchObject({ code: "CURRENCY" });
  await prisma.projectIntegration.delete({ where: { projectId } });
  expect(await jobs.complete(job, snapshot(), now)).toBe(false);
  expect(await prisma.campaign.count()).toBe(0);
});
it("retries transient failures with bounded backoff and stops automatic token retries", async () => {
  const job = (await jobs.claim(now))!;
  await jobs.fail(job, new MetaError("PROVIDER", 120_000), now);
  expect(await jobs.claim(new Date(now.getTime() + 60_000))).toBeNull();
  const retry = (await jobs.claim(new Date(now.getTime() + 120_000)))!;
  expect(retry.retryCount).toBe(1);
  await jobs.fail(retry, new MetaError("TOKEN"), now);
  expect(await jobs.claim(new Date("2026-09-10"))).toBeNull();
  expect((await prisma.projectIntegration.findUniqueOrThrow({ where: { projectId } })).lastError).toBe("TOKEN");
});
it("manual work before morning preserves the upcoming daily occurrence", async () => {
  const tomorrow = new Date("2026-09-09T06:00:00Z");
  await prisma.projectIntegration.update({ where: { projectId }, data: { nextDailyAt: tomorrow } });
  await jobs.complete((await jobs.claim(now))!, snapshot(), now);
  expect((await prisma.projectIntegration.findUniqueOrThrow({ where: { projectId } })).nextDailyAt).toEqual(tomorrow);
});
it("exhausts three retries and resumes at the next morning", async () => {
  let time = now;
  for (const delay of [60_000, 300_000, 900_000]) {
    const job = (await jobs.claim(time))!;
    await jobs.fail(job, new MetaError("PROVIDER"), time);
    const row = await prisma.projectIntegration.findUniqueOrThrow({ where: { projectId } });
    expect(row.queuedAt?.getTime()).toBe(time.getTime() + delay);
    time = row.queuedAt!;
  }
  await jobs.fail((await jobs.claim(time))!, new MetaError("PROVIDER"), time);
  const failed = await prisma.projectIntegration.findUniqueOrThrow({ where: { projectId } });
  expect(failed).toMatchObject({ status: "ERROR", queuedAt: null, retryCount: 0 });
  expect(await jobs.claim(new Date(time.getTime() + 60_000))).toBeNull();
  expect(await jobs.claim(failed.nextDailyAt)).not.toBeNull();
});
