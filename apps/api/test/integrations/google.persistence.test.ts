import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { PrismaGoogleAuthorizations } from "../../src/modules/integrations/infrastructure/prisma-google-authorizations.js";
import { PrismaImportJobs } from "../../src/modules/integrations/infrastructure/prisma-import-jobs.js";
import { PrismaLeadPollJobs } from "../../src/modules/integrations/infrastructure/prisma-lead-poll-jobs.js";
import { PrismaUnitOfWork } from "../../src/shared/infrastructure/prisma-unit-of-work.js";
import type { Snapshot } from "../../src/modules/integrations/domain/snapshot.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { signInAs } from "../helpers/auth.js";

const now = new Date("2026-09-08T06:00:00Z");
const minutes = (count: number) => new Date(now.getTime() + count * 60_000);
const authorizations = new PrismaGoogleAuthorizations(prisma);
let projectId: string;
let userId: string;

beforeEach(async () => {
  await resetDb();
  const member = await signInAs();
  userId = member.user.id;
  ({ projectId } = await seedProject(userId));
});
afterAll(() => prisma.$disconnect());

describe("pending Google sign-ins", () => {
  const open = (expiresAt = minutes(10)) => authorizations.open({ projectId, userId, integrationId: null }, now, expiresAt);

  it("are found until they expire", async () => {
    const opened = await open();
    expect(await authorizations.read(opened.id, now)).toMatchObject({ id: opened.id, projectId, userId, encryptedRefreshToken: null });
    expect(await authorizations.read(opened.id, minutes(11))).toBeNull();
  });

  it("take the credential once, whoever asks first", async () => {
    const opened = await open();
    const results = await Promise.all([
      authorizations.grant(opened.id, "enc-a", now, minutes(30)),
      authorizations.grant(opened.id, "enc-b", now, minutes(30)),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
    const stored = await prisma.googleAuthorization.findUniqueOrThrow({ where: { id: opened.id } });
    expect(["enc-a", "enc-b"]).toContain(stored.encryptedRefreshToken);
  });

  it("do not take a credential once expired", async () => {
    const opened = await open();
    expect(await authorizations.grant(opened.id, "enc", minutes(11), minutes(40))).toBe(false);
  });

  it("are swept away with the expired ones when another is opened", async () => {
    const stale = await open(minutes(1));
    await authorizations.open({ projectId, userId, integrationId: null }, minutes(5), minutes(15));
    expect(await prisma.googleAuthorization.findUnique({ where: { id: stale.id } })).toBeNull();
  });

  it("go when closed and when their project goes", async () => {
    const closed = await open();
    await authorizations.close(closed.id);
    expect(await prisma.googleAuthorization.findUnique({ where: { id: closed.id } })).toBeNull();

    const orphaned = await open();
    await prisma.project.delete({ where: { id: projectId } });
    expect(await prisma.googleAuthorization.findUnique({ where: { id: orphaned.id } })).toBeNull();
  });
});

describe("importing a Google account", () => {
  const snapshot = (): Snapshot => ({
    from: "2026-08-09", to: "2026-09-07",
    campaigns: [{ id: "9001", name: "Search", status: "ACTIVE", objective: "SEARCH" }],
    adSets: [{ id: "9002", parentId: "9001", name: "Group", status: "ACTIVE" }],
    ads: [{ id: "9003", parentId: "9002", name: "Ad 9003", status: "ACTIVE" }],
    campaignMetrics: [{ externalId: "9001", date: "2026-09-07", spend: "12.3457", impressions: 30, reach: 0, clicks: 3, conversions: 1, results: 1, revenue: "20.0000" }],
    adSetMetrics: [{ externalId: "9002", date: "2026-09-07", spend: "12.3457", impressions: 30, reach: 0, clicks: 3, conversions: 1, results: 1, revenue: "20.0000" }],
    adMetrics: [{ externalId: "9003", date: "2026-09-07", spend: "12.3457", impressions: 30, reach: 0, clicks: 3, conversions: 1, results: 1, revenue: "20.0000" }],
  });

  beforeEach(async () => {
    await prisma.project.update({ where: { id: projectId }, data: { budgetCurrency: "USD" } });
    await prisma.projectIntegration.create({
      data: { projectId, provider: "GOOGLE", accountId: "222", loginCustomerId: "111", currency: "USD", timezone: "UTC", encryptedToken: "enc", revision: "v1", nextDailyAt: now, queuedAt: now },
    });
  });

  it("files its campaigns under the Google channel, with the account they came from", async () => {
    const jobs = new PrismaImportJobs(prisma);
    const job = (await jobs.claim(now))!;
    expect(job).toMatchObject({ provider: "GOOGLE", loginCustomerId: "111" });

    expect(await jobs.complete(job, snapshot(), now)).toBe(true);

    expect(await prisma.campaign.findFirstOrThrow({ where: { externalId: "9001" } }))
      .toMatchObject({ channel: "GOOGLE", sourceAccountId: "222", objective: "SEARCH", projectId });
    expect(await prisma.campaignDailyMetric.count()).toBe(1);
  });

  it("is repeated without duplicates", async () => {
    const jobs = new PrismaImportJobs(prisma);
    await jobs.complete((await jobs.claim(now))!, snapshot(), now);
    await prisma.projectIntegration.updateMany({ data: { queuedAt: now, status: "QUEUED", leaseUntil: null, leaseOwner: null } });
    await jobs.complete((await jobs.claim(now))!, snapshot(), now);

    expect(await prisma.campaign.count()).toBe(1);
    expect(await prisma.campaignDailyMetric.count()).toBe(1);
  });

  it("keeps the account's categories and each day's conversions by category, replacing the window", async () => {
    const jobs = new PrismaImportJobs(prisma);
    const categorised = (contacts: string): Snapshot => ({
      ...snapshot(),
      campaigns: [{ ...snapshot().campaigns[0]!, conversionCategories: ["CONTACT", "SUBMIT_LEAD_FORM"] }],
      campaignResults: [{ externalId: "9001", date: "2026-09-07", category: "CONTACT", results: contacts }],
      adSetResults: [{ externalId: "9002", date: "2026-09-07", category: "CONTACT", results: "1.0000" }],
      adResults: [{ externalId: "9003", date: "2026-09-07", category: "SUBMIT_LEAD_FORM", results: "2.0000" }],
    });

    await jobs.complete((await jobs.claim(now))!, categorised("3.9966"), now);
    await prisma.projectIntegration.updateMany({ data: { queuedAt: now, status: "QUEUED", leaseUntil: null, leaseOwner: null } });
    await jobs.complete((await jobs.claim(now))!, categorised("5.0000"), now);

    expect((await prisma.campaign.findFirstOrThrow({ where: { externalId: "9001" } })).conversionCategories)
      .toEqual(["CONTACT", "SUBMIT_LEAD_FORM"]);
    const [campaignResult] = await prisma.campaignDailyResult.findMany();
    expect(await prisma.campaignDailyResult.count()).toBe(1);
    expect(campaignResult).toMatchObject({ category: "CONTACT", date: new Date("2026-09-07T00:00:00Z") });
    expect(campaignResult!.results.toNumber()).toBe(5);
    expect(await prisma.adSetDailyResult.count()).toBe(1);
    expect((await prisma.adDailyResult.findFirstOrThrow()).category).toBe("SUBMIT_LEAD_FORM");
  });

  it("leaves a campaign's categories alone when the snapshot names none", async () => {
    const jobs = new PrismaImportJobs(prisma);
    await jobs.complete((await jobs.claim(now))!, {
      ...snapshot(), campaigns: [{ ...snapshot().campaigns[0]!, conversionCategories: ["CONTACT"] }],
    }, now);
    await prisma.projectIntegration.updateMany({ data: { queuedAt: now, status: "QUEUED", leaseUntil: null, leaseOwner: null } });
    await jobs.complete((await jobs.claim(now))!, snapshot(), now);

    expect((await prisma.campaign.findFirstOrThrow({ where: { externalId: "9001" } })).conversionCategories).toEqual(["CONTACT"]);
  });

  it("waits for a new sign-in when Google revoked the old one", async () => {
    const jobs = new PrismaImportJobs(prisma);
    const job = (await jobs.claim(now))!;
    const { ProviderError } = await import("../../src/modules/integrations/domain/integration.js");

    await jobs.fail(job, new ProviderError("TOKEN", 0, "", "Google"), now);

    expect(await prisma.projectIntegration.findFirstOrThrow()).toMatchObject({ status: "AUTH_REQUIRED", lastError: "TOKEN" });
    expect(await jobs.claim(minutes(60 * 24))).toBeNull();
  });

  it("is left out of the Meta lead polls whatever its flag says", async () => {
    await prisma.projectIntegration.updateMany({
      data: { leadsEnabled: true, status: "SUCCESS", lastSuccessAt: now, nextLeadsAt: now },
    });
    const polls = new PrismaLeadPollJobs(prisma, new PrismaUnitOfWork(prisma));
    expect(await polls.claim(minutes(1))).toBeNull();
  });
});
