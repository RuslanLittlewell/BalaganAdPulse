import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { PrismaUnitOfWork } from "../../src/shared/infrastructure/prisma-unit-of-work.js";
import { PrismaLeadPollJobs } from "../../src/modules/integrations/infrastructure/prisma-lead-poll-jobs.js";
import { PrismaImportJobs } from "../../src/modules/integrations/infrastructure/prisma-import-jobs.js";
import { PrismaIntegrationRepository } from "../../src/modules/integrations/infrastructure/prisma-integration-repository.js";
import { MetaError } from "../../src/modules/integrations/domain/integration.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { currentOrg, signInAs } from "../helpers/auth.js";

const now = new Date("2026-09-13T10:00:00Z");
const unitOfWork = new PrismaUnitOfWork(prisma);
const jobs = new PrismaLeadPollJobs(prisma, unitOfWork);
let projectId: string;
let clientId: string;

beforeEach(async () => {
  await resetDb();
  const member = await signInAs();
  ({ projectId, clientId } = await seedProject(member.user.id));
  await prisma.projectIntegration.create({
    data: {
      projectId, accountId: "123", currency: "BYN", timezone: "UTC", encryptedToken: "encrypted", revision: "v1",
      status: "SUCCESS", lastSuccessAt: new Date("2026-09-13T06:00:00Z"), nextDailyAt: new Date("2026-09-14T06:00:00Z"),
      nextLeadsAt: now,
    },
  });
});

afterAll(() => prisma.$disconnect());

describe("claiming lead polls", () => {
  it("starts existing connections waiting, with no coverage and a poll due at once", async () => {
    const row = await prisma.projectIntegration.findUniqueOrThrow({ where: { projectId } });

    expect(row).toMatchObject({ leadsStatus: "WAITING", leadsCoveredUntil: null, leadsLastSuccessAt: null, leadsLastError: null, leadsQueuedAt: null, nextSweepAt: null, leadsLeaseOwner: null, leadsLeaseUntil: null });
  });

  it("claims a due connection with the board it delivers to", async () => {
    const job = await jobs.claim(now);

    expect(job).toMatchObject({ projectId, accountId: "123", revision: "v1", clientId, orgId: (await currentOrg()).id, leadsCoveredUntil: null });
    expect(job!.leadsLeaseOwner).toEqual(expect.any(String));
    expect(job!.leadsLeaseUntil!.getTime()).toBeGreaterThan(now.getTime());
  });

  it("waits for the first successful advertising import", async () => {
    await prisma.projectIntegration.update({ where: { projectId }, data: { lastSuccessAt: null, status: "RUNNING" } });

    expect(await jobs.claim(now)).toBeNull();
  });

  it("does not poll a connection waiting for a new token", async () => {
    await prisma.projectIntegration.update({ where: { projectId }, data: { status: "AUTH_REQUIRED" } });

    expect(await jobs.claim(now)).toBeNull();
  });

  it("does not poll before the next poll, a manual request or a sweep is due", async () => {
    await prisma.projectIntegration.update({ where: { projectId }, data: { nextLeadsAt: new Date(now.getTime() + 60_000) } });
    expect(await jobs.claim(now)).toBeNull();

    await prisma.projectIntegration.update({ where: { projectId }, data: { leadsQueuedAt: now } });
    expect(await jobs.claim(now)).not.toBeNull();
  });

  it("is claimed for a due sweep alone", async () => {
    await prisma.projectIntegration.update({ where: { projectId }, data: { nextLeadsAt: new Date(now.getTime() + 60_000), nextSweepAt: now } });

    expect(await jobs.claim(now)).toMatchObject({ sweepDue: true, pollDue: false });
  });

  it("gives one owner across competing claims and recovers an expired lease", async () => {
    const claims = await Promise.all([jobs.claim(now), jobs.claim(now), jobs.claim(now)]);
    expect(claims.filter(Boolean)).toHaveLength(1);

    const later = new Date(now.getTime() + 180_001);
    const recovered = await jobs.claim(later);
    expect(recovered).not.toBeNull();
    expect(recovered!.leadsLeaseOwner).not.toBe(claims.find(Boolean)!.leadsLeaseOwner);
  });

  it("claims a lead poll while an advertising import holds its own lease", async () => {
    await prisma.projectIntegration.update({ where: { projectId }, data: { status: "RUNNING", leaseOwner: "importer", leaseUntil: new Date(now.getTime() + 600_000) } });

    expect(await jobs.claim(now)).not.toBeNull();
    expect(await prisma.projectIntegration.findUniqueOrThrow({ where: { projectId } })).toMatchObject({ leaseOwner: "importer", status: "RUNNING" });
  });
});

it("applies the lead poll migration to populated integrations without changing them", async () => {
  const schema = `migration_${randomUUID().replaceAll("-", "")}`;
  const sql = readFileSync(new URL("../../prisma/migrations/20260913130000_lead_poll_schedule/migration.sql", import.meta.url), "utf8");
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
    await tx.$executeRawUnsafe("CREATE TABLE project_integration (project_id TEXT PRIMARY KEY, account_id TEXT NOT NULL, status TEXT NOT NULL)");
    await tx.$executeRaw`INSERT INTO project_integration VALUES ('old-project', '123', 'SUCCESS')`;
    for (const statement of sql.split(";").filter((part) => part.trim())) await tx.$executeRawUnsafe(statement);
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`SELECT * FROM project_integration`;
    expect(rows).toEqual([expect.objectContaining({
      project_id: "old-project", account_id: "123", status: "SUCCESS",
      leads_status: "WAITING", leads_covered_until: null, leads_last_success_at: null, leads_last_error: null,
      leads_queued_at: null, next_sweep_at: null, leads_lease_owner: null, leads_lease_until: null,
      next_leads_at: expect.any(Date),
    })]);
    await tx.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  });
});

describe("recording lead polls", () => {
  const read = () => prisma.projectIntegration.findUniqueOrThrow({ where: { projectId } });

  it("advances coverage, schedules the next poll in ten minutes and releases the lease on success", async () => {
    await prisma.projectIntegration.update({ where: { projectId }, data: { leadsQueuedAt: now, leadsLastError: "PROVIDER", leadsStatus: "ERROR" } });
    const job = (await jobs.claim(now))!;

    await unitOfWork.run(async (context) => {
      expect(await jobs.hold(context, job, now)).toBe(true);
      await jobs.succeed(context, job, { polled: true, swept: false, coveredUntil: now }, now);
    });

    expect(await read()).toMatchObject({
      leadsStatus: "OK", leadsLastError: null, leadsLastSuccessAt: now, leadsCoveredUntil: now,
      nextLeadsAt: new Date(now.getTime() + 600_000), leadsQueuedAt: null, leadsLeaseOwner: null, leadsLeaseUntil: null,
    });
  });

  it("keeps coverage and the next poll after a sweep-only run", async () => {
    const covered = new Date(now.getTime() - 60_000);
    const nextLeadsAt = new Date(now.getTime() + 300_000);
    await prisma.projectIntegration.update({ where: { projectId }, data: { leadsCoveredUntil: covered, nextLeadsAt, nextSweepAt: now } });
    const job = (await jobs.claim(now))!;

    await unitOfWork.run((context) => jobs.succeed(context, job, { polled: false, swept: true, coveredUntil: covered }, now));

    expect(await read()).toMatchObject({ leadsCoveredUntil: covered, nextLeadsAt, nextSweepAt: null, leadsStatus: "OK" });
  });

  it("keeps a sweep requested while the previous one ran", async () => {
    await prisma.projectIntegration.update({ where: { projectId }, data: { nextSweepAt: now } });
    const job = (await jobs.claim(now))!;
    const requestedAgain = new Date(now.getTime() + 1_000);
    await prisma.projectIntegration.update({ where: { projectId }, data: { nextSweepAt: requestedAgain } });

    await unitOfWork.run((context) => jobs.succeed(context, job, { polled: true, swept: true, coveredUntil: now }, now));

    expect((await read()).nextSweepAt).toEqual(requestedAgain);
  });

  it("refuses to hold a poll after token replacement, disconnect or an expired lease", async () => {
    const job = (await jobs.claim(now))!;
    const holds = (at = now) => unitOfWork.run((context) => jobs.hold(context, job, at));

    expect(await holds(new Date(now.getTime() + 180_001))).toBe(false);
    await prisma.projectIntegration.update({ where: { projectId }, data: { revision: "replaced" } });
    expect(await holds()).toBe(false);
    await prisma.projectIntegration.update({ where: { projectId }, data: { revision: job.revision } });
    expect(await holds()).toBe(true);
    await prisma.projectIntegration.delete({ where: { projectId } });
    expect(await holds()).toBe(false);
  });

  it("marks only lead import as needing access, retries hourly and recovers", async () => {
    await prisma.projectIntegration.update({ where: { projectId }, data: { nextSweepAt: now } });
    const job = (await jobs.claim(now))!;

    await jobs.fail(job, new MetaError("ACCESS"), now);

    expect(await read()).toMatchObject({
      status: "SUCCESS", lastError: null, leadsStatus: "ACCESS_REQUIRED", leadsLastError: "ACCESS",
      nextLeadsAt: new Date(now.getTime() + 3_600_000), nextSweepAt: new Date(now.getTime() + 3_600_000), leadsLeaseOwner: null,
    });
    expect(await jobs.claim(new Date(now.getTime() + 3_599_000))).toBeNull();
    const retry = (await jobs.claim(new Date(now.getTime() + 3_600_000)))!;
    expect(retry).not.toBeNull();
    await unitOfWork.run((context) => jobs.succeed(context, retry, { polled: true, swept: true, coveredUntil: now }, new Date(now.getTime() + 3_600_000)));
    expect(await read()).toMatchObject({ leadsStatus: "OK", leadsLastError: null });
  });

  it("sends a rejected token to credential replacement and stops polling", async () => {
    const job = (await jobs.claim(now))!;

    await jobs.fail(job, new MetaError("TOKEN"), now);

    expect(await read()).toMatchObject({ status: "AUTH_REQUIRED", lastError: "TOKEN", leadsLastError: "TOKEN" });
    expect(await jobs.claim(new Date("2026-09-20T00:00:00Z"))).toBeNull();
  });

  it("retries a transient failure at the next poll or later when Meta asks", async () => {
    let job = (await jobs.claim(now))!;
    await jobs.fail(job, new MetaError("PROVIDER"), now);
    expect(await read()).toMatchObject({ leadsStatus: "ERROR", leadsLastError: "PROVIDER", nextLeadsAt: new Date(now.getTime() + 600_000), status: "SUCCESS" });

    const later = new Date(now.getTime() + 600_000);
    job = (await jobs.claim(later))!;
    await jobs.fail(job, new MetaError("PROVIDER", 1_800_000), later);
    expect((await read()).nextLeadsAt).toEqual(new Date(later.getTime() + 1_800_000));
  });

  it("records nothing for a poll that lost its lease", async () => {
    const job = (await jobs.claim(now))!;
    await prisma.projectIntegration.update({ where: { projectId }, data: { revision: "replaced" } });

    await jobs.fail(job, new MetaError("ACCESS"), now);

    expect(await read()).toMatchObject({ leadsStatus: "WAITING", leadsLeaseOwner: job.leadsLeaseOwner });
  });
});

describe("choosing ads for the daily sweep", () => {
  async function adWithLeads(target: string, externalId: string, date: string, conversions: number, channel: "META" | "GOOGLE" = "META") {
    const campaign = await prisma.campaign.create({ data: { projectId: target, name: `Кампания ${externalId}`, channel, externalId: `c${externalId}`, position: 0 } });
    const adSet = await prisma.adSet.create({ data: { campaignId: campaign.id, name: `Группа ${externalId}`, externalId: `s${externalId}`, position: 0 } });
    const ad = await prisma.ad.create({ data: { adSetId: adSet.id, name: `Объявление ${externalId}`, externalId, position: 0 } });
    await prisma.adDailyMetric.create({ data: { adId: ad.id, date: new Date(`${date}T00:00:00Z`), conversions } });
  }

  it("returns the project's Meta ads that recorded leads since the sweep window opened", async () => {
    const other = await seedProject("unused", "Другой");
    await adWithLeads(projectId, "1", "2026-09-11", 2);
    await adWithLeads(projectId, "2", "2026-09-12", 0);
    await adWithLeads(projectId, "3", "2026-09-05", 4);
    await adWithLeads(other.projectId, "4", "2026-09-12", 1);
    await adWithLeads(projectId, "5", "2026-09-12", 1, "GOOGLE");
    const job = (await jobs.claim(now))!;

    expect(await jobs.sweepAds(job, new Date("2026-09-10T10:00:00Z"))).toEqual([
      { adId: "1", adName: "Объявление 1", adSet: { externalId: "s1", name: "Группа 1" }, campaign: { externalId: "c1", name: "Кампания 1" } },
    ]);
  });
});

describe("what sets lead polling in motion", () => {
  it("requests a sweep when an advertising import commits", async () => {
    await prisma.projectIntegration.update({ where: { projectId }, data: { queuedAt: now, status: "QUEUED" } });
    const importJobs = new PrismaImportJobs(prisma);
    const job = (await importJobs.claim(now))!;

    await importJobs.complete(job, { from: "2026-08-13", to: "2026-09-12", campaigns: [], adSets: [], ads: [], campaignMetrics: [], adSetMetrics: [], adMetrics: [] }, now);

    expect((await prisma.projectIntegration.findUniqueOrThrow({ where: { projectId } })).nextSweepAt).toEqual(now);
  });

  it("queues a lead poll on manual refresh even while an advertising import runs", async () => {
    await prisma.projectIntegration.update({ where: { projectId }, data: { status: "RUNNING", leaseOwner: "importer", leaseUntil: new Date(now.getTime() + 600_000) } });
    const repository = new PrismaIntegrationRepository(prisma, unitOfWork);

    await repository.queue(projectId, now);

    expect(await prisma.projectIntegration.findUniqueOrThrow({ where: { projectId } })).toMatchObject({ leadsQueuedAt: now, status: "RUNNING" });
  });

  it("keeps the covered period when the token of the same account is replaced and starts over for another account", async () => {
    const covered = new Date(now.getTime() - 60_000);
    await prisma.projectIntegration.update({ where: { projectId }, data: { leadsCoveredUntil: covered, leadsStatus: "ACCESS_REQUIRED", leadsLastError: "ACCESS", nextLeadsAt: new Date(now.getTime() + 3_600_000), leadsLastSuccessAt: covered } });
    const repository = new PrismaIntegrationRepository(prisma, unitOfWork);
    const account = { accountId: "123", currency: "BYN", timezone: "UTC", projectId, encryptedToken: "replaced", queuedAt: now, nextDailyAt: now };

    await unitOfWork.run((context) => repository.save(context, account, now));
    expect(await prisma.projectIntegration.findUniqueOrThrow({ where: { projectId } })).toMatchObject({
      leadsCoveredUntil: covered, leadsLastSuccessAt: covered, leadsStatus: "WAITING", leadsLastError: null, nextLeadsAt: now,
    });

    await unitOfWork.run((context) => repository.save(context, { ...account, accountId: "456" }, now));
    expect(await prisma.projectIntegration.findUniqueOrThrow({ where: { projectId } })).toMatchObject({
      leadsCoveredUntil: null, leadsLastSuccessAt: null, leadsStatus: "WAITING", nextLeadsAt: now, nextSweepAt: null,
    });
  });
});
