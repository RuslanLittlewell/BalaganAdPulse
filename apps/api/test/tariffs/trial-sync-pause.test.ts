import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { isTrialExpired, type Tariff } from "@adpulse/access-policy";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { PrismaUnitOfWork } from "../../src/shared/infrastructure/prisma-unit-of-work.js";
import { liveOrganizationFilter } from "../../src/shared/infrastructure/live-organization.js";
import { PrismaImportJobs as AdImportJobs } from "../../src/modules/integrations/infrastructure/prisma-import-jobs.js";
import { PrismaLeadPollJobs } from "../../src/modules/integrations/infrastructure/prisma-lead-poll-jobs.js";
import { PrismaImportJobs as SearchImportJobs } from "../../src/modules/seo/infrastructure/prisma-import-jobs.js";
import { PrismaTrafficJobs } from "../../src/modules/seo/infrastructure/prisma-traffic-jobs.js";
import { PrismaCheckJobs } from "../../src/modules/seo/infrastructure/prisma-check-jobs.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { createOrg, currentOrg, signInAs } from "../helpers/auth.js";

const now = new Date("2026-11-20T10:00:00Z");
const past = new Date("2026-11-19T10:00:00Z");
const future = new Date("2026-11-27T10:00:00Z");
const unitOfWork = new PrismaUnitOfWork(prisma);

afterAll(() => prisma.$disconnect());

describe("the live organization filter", () => {
  const cases: Array<[Tariff, Date | null]> = [
    ["TRIAL", past], ["TRIAL", now], ["TRIAL", future], ["TRIAL", null],
    ["SOLO", past], ["BUSINESS", null], ["AGENCY", past], ["AGENCY_PRO", future], ["ENTERPRISE", past],
  ];

  it("agrees with isTrialExpired for every tariff and end date", async () => {
    await resetDb();
    const made = await Promise.all(cases.map(async ([tariff, trialEndsAt], index) =>
      prisma.organization.create({ data: { name: `Org ${index}`, slug: `org-${index}`, tariff, trialEndsAt } })));

    const live = new Set((await prisma.organization.findMany({
      where: { id: { in: made.map(({ id }) => id) }, ...liveOrganizationFilter(now) },
    })).map(({ id }) => id));

    for (const organization of made) {
      expect(live.has(organization.id), `${organization.tariff} ${String(organization.trialEndsAt)}`)
        .toBe(!isTrialExpired(organization, now));
    }
  });
});

interface Scenario {
  readonly name: string;
  readonly seed: (projectId: string) => Promise<void>;
  readonly claim: () => Promise<unknown>;
}

const site = (projectId: string, extra: Record<string, unknown>) => prisma.seoSite.create({
  data: {
    projectId, siteUrl: "https://shop.ru/", encryptedToken: "sealed", revision: "v1", status: "SUCCESS",
    nextDailyAt: new Date("2026-11-30T07:00:00Z"), nextCheckAt: new Date("2026-11-30T07:00:00Z"), ...extra,
  },
});

const scenarios: Scenario[] = [
  {
    name: "the ad metrics import",
    seed: async (projectId) => {
      await prisma.projectIntegration.create({ data: {
        projectId, accountId: "123", currency: "BYN", timezone: "UTC", encryptedToken: "encrypted",
        revision: "v1", nextDailyAt: now, queuedAt: now,
      } });
    },
    claim: () => new AdImportJobs(prisma).claim(now),
  },
  {
    name: "the Meta lead poll",
    seed: async (projectId) => {
      await prisma.projectIntegration.create({ data: {
        projectId, accountId: "123", currency: "BYN", timezone: "UTC", encryptedToken: "encrypted", revision: "v1",
        status: "SUCCESS", lastSuccessAt: new Date("2026-11-20T06:00:00Z"), nextDailyAt: new Date("2026-11-30T06:00:00Z"),
        nextLeadsAt: now, leadsEnabled: true,
      } });
    },
    claim: () => new PrismaLeadPollJobs(prisma, unitOfWork).claim(now),
  },
  {
    name: "the Search Console import",
    seed: async (projectId) => { await site(projectId, { status: "QUEUED", queuedAt: now }); },
    claim: () => new SearchImportJobs(prisma).claim(now),
  },
  {
    name: "the Analytics traffic import",
    seed: async (projectId) => { await site(projectId, { analyticsPropertyId: "properties/1", trafficQueuedAt: now }); },
    claim: () => new PrismaTrafficJobs(prisma).claim(now),
  },
  {
    name: "the site page check",
    seed: async (projectId) => { await site(projectId, { checkQueuedAt: now }); },
    claim: () => new PrismaCheckJobs(prisma).claim(now),
  },
];

describe.each(scenarios)("$name", ({ seed, claim }) => {
  let orgId: string;
  let projectId: string;

  const setTrial = (data: { tariff: Tariff; trialEndsAt: Date | null }) =>
    prisma.organization.update({ where: { id: orgId }, data });
  const schedule = async () => JSON.stringify([
    await prisma.projectIntegration.findMany({ orderBy: { id: "asc" } }),
    await prisma.seoSite.findMany({ orderBy: { id: "asc" } }),
  ]);

  beforeEach(async () => {
    await resetDb();
    const member = await signInAs();
    ({ projectId } = await seedProject(member.user.id));
    orgId = (await currentOrg()).id;
    await seed(projectId);
  });

  it("starts for a trial that is still running", async () => {
    await setTrial({ tariff: "TRIAL", trialEndsAt: future });
    expect(await claim()).not.toBeNull();
  });

  it("starts for a paid tariff", async () => {
    await setTrial({ tariff: "BUSINESS", trialEndsAt: null });
    expect(await claim()).not.toBeNull();
  });

  it("does not start once the trial has ended, and leaves the schedule alone", async () => {
    await setTrial({ tariff: "TRIAL", trialEndsAt: past });
    const before = await schedule();

    expect(await claim()).toBeNull();
    expect(await schedule()).toBe(before);
  });

  it("starts at once when a tariff is assigned afterwards", async () => {
    await setTrial({ tariff: "TRIAL", trialEndsAt: past });
    expect(await claim()).toBeNull();

    await setTrial({ tariff: "BUSINESS", trialEndsAt: null });

    expect(await claim()).not.toBeNull();
  });

  it("is not blocked by another organization whose trial has ended", async () => {
    const other = await createOrg("Frozen", "frozen");
    await prisma.organization.update({ where: { id: other.id }, data: { tariff: "TRIAL", trialEndsAt: past } });
    await setTrial({ tariff: "BUSINESS", trialEndsAt: null });

    expect(await claim()).not.toBeNull();
  });
});
