import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import {
  PrismaKpiMonthClaims,
  PrismaNotificationRecipients,
  PrismaNotificationRepository,
  PrismaProjectKpiStandings,
} from "../../src/modules/notifications/infrastructure/prisma-notifications.js";
import { resetDb, seedCampaign, seedProject } from "../helpers/db.js";
import { grantAccess, signInAs, signInAsOutsider } from "../helpers/auth.js";

const repository = new PrismaNotificationRepository(prisma);
const recipients = new PrismaNotificationRecipients(prisma);
const standings = new PrismaProjectKpiStandings(prisma);
const claims = new PrismaKpiMonthClaims(prisma);

const OCTOBER_SO_FAR = { from: "2026-10-01", to: "2026-10-15" };

let clientId: string;
let projectId: string;

beforeEach(async () => {
  await resetDb();
  ({ clientId, projectId } = await seedProject("unused", "Клиника"));
});

afterAll(() => prisma.$disconnect());

const membershipOf = async (name: string, options: Parameters<typeof signInAs>[1] = {}) =>
  (await signInAs(name, options)).membership!.id;

describe("who reaches a project", () => {
  it("is every active admin and the managers and guests given its client or the project itself", async () => {
    const admin = await membershipOf("Admin");
    const clientWide = await membershipOf("Manager", { role: "MANAGER" });
    await grantAccess(clientWide, clientId);
    const projectOnly = await membershipOf("Guest", { role: "GUEST" });
    await grantAccess(projectOnly, clientId, projectId);
    const elsewhere = await membershipOf("Elsewhere", { role: "MANAGER" });
    const other = await seedProject("unused", "Автосалон");
    await grantAccess(elsewhere, other.clientId, other.projectId);
    const customer = await membershipOf("Customer", { role: "CLIENT" });
    await grantAccess(customer, clientId);
    await membershipOf("Suspended", { role: "ADMIN", status: "SUSPENDED" });
    await signInAsOutsider("Outsider");

    expect((await recipients.staffReaching(projectId)).sort()).toEqual([admin, clientWide, projectOnly].sort());
  });

  it("is nobody for a project that is gone", async () => {
    await membershipOf("Admin");

    expect(await recipients.staffReaching("00000000-0000-0000-0000-000000000000")).toEqual([]);
  });

  it("tells active members apart from customers and drops the suspended", async () => {
    const manager = await membershipOf("Manager", { role: "MANAGER" });
    const customer = await membershipOf("Customer", { role: "CLIENT" });
    const suspended = await membershipOf("Suspended", { role: "MANAGER", status: "SUSPENDED" });

    const active = await recipients.activeMembers([manager, customer, suspended]);

    expect(active.sort((a, b) => a.id.localeCompare(b.id))).toEqual(
      [{ id: manager, customer: false }, { id: customer, customer: true }].sort((a, b) => a.id.localeCompare(b.id)),
    );
  });
});

describe("stored notifications", () => {
  it("carry the project, the task and the actor's current names, newest first", async () => {
    const anna = await signInAs("Анна");
    const boris = await membershipOf("Борис");
    const task = await prisma.task.create({ data: {
      orgId: anna.membership!.orgId, projectId, title: "Позвонить клиенту", priority: "MEDIUM", position: 0,
    } });
    await repository.createMany([
      { recipientId: boris, kind: "PROJECT_CREATED", projectId, taskId: null, actorId: anna.membership!.id },
    ]);
    const [assigned] = await repository.createMany([
      { recipientId: boris, kind: "TASK_ASSIGNED", projectId, taskId: task.id, actorId: anna.membership!.id },
    ]);
    await prisma.project.update({ where: { id: projectId }, data: { name: "Клиника 2" } });

    expect(assigned).toMatchObject({ recipientId: boris, task: { id: task.id, title: "Позвонить клиенту", projectId } });
    const latest = await repository.latest(boris, 50);
    expect(latest.map((notification) => notification.kind)).toEqual(["TASK_ASSIGNED", "PROJECT_CREATED"]);
    expect(latest[1]).toMatchObject({ project: { id: projectId, name: "Клиника 2" }, task: null, actor: { name: "Анна" }, readAt: null });
  });

  it("are read one at a time only by their recipient, and all at once", async () => {
    const anna = await membershipOf("Анна");
    const boris = await membershipOf("Борис");
    const [first, second] = await repository.createMany([
      { recipientId: anna, kind: "KPI_MET", projectId, taskId: null, actorId: null },
      { recipientId: anna, kind: "KPI_MET", projectId, taskId: null, actorId: null },
    ]);
    const at = new Date("2026-10-15T12:00:00Z");

    expect(await repository.markRead(boris, first!.id, at)).toBe(false);
    expect(await repository.unreadCount(anna)).toBe(2);
    expect(await repository.markRead(anna, first!.id, at)).toBe(true);
    expect(await repository.markRead(anna, first!.id, at)).toBe(true);
    expect(await repository.unreadCount(anna)).toBe(1);

    await repository.markAllRead(anna, at);

    expect(await repository.unreadCount(anna)).toBe(0);
    expect((await repository.latest(anna, 50)).find((n) => n.id === second!.id)?.readAt).toEqual(at);
  });

  it("go with their task and keep going without their actor", async () => {
    const anna = await signInAs("Анна");
    const boris = await membershipOf("Борис");
    const task = await prisma.task.create({ data: {
      orgId: anna.membership!.orgId, projectId, title: "Бриф", priority: "MEDIUM", position: 0,
    } });
    await repository.createMany([
      { recipientId: boris, kind: "TASK_ASSIGNED", projectId, taskId: task.id, actorId: anna.membership!.id },
      { recipientId: boris, kind: "PROJECT_CREATED", projectId, taskId: null, actorId: anna.membership!.id },
    ]);

    await prisma.task.delete({ where: { id: task.id } });
    await prisma.membership.delete({ where: { id: anna.membership!.id } });

    const left = await repository.latest(boris, 50);
    expect(left).toHaveLength(1);
    expect(left[0]).toMatchObject({ kind: "PROJECT_CREATED", actor: null });
  });
});

describe("a project's standing this month", () => {
  it("sums its campaigns' days within the month so far", async () => {
    await prisma.project.update({ where: { id: projectId }, data: { kpiMetric: "CONVERSIONS", kpiTarget: "62" } });
    const campaign = await seedCampaign(projectId);
    const day = (date: string, conversions: number, spend: number) =>
      ({ campaignId: campaign.id, date: new Date(`${date}T00:00:00Z`), conversions, spend });
    await prisma.campaignDailyMetric.createMany({ data: [
      day("2026-09-30", 100, 900), day("2026-10-01", 10, 100), day("2026-10-15", 20, 200), day("2026-10-16", 100, 900),
    ] });

    const standing = await standings.read(projectId, OCTOBER_SO_FAR);

    expect(standing?.kpi).toEqual({ metric: "CONVERSIONS", target: "62.0000" });
    expect(standing?.figures).toMatchObject({ conversions: 30, spend: 300, cpa: 10 });
  });

  it("reads a KPI set by hand with its name and value", async () => {
    await prisma.project.update({ where: { id: projectId }, data: {
      kpiMetric: "MANUAL", kpiTarget: "40", kpiName: "Продажи", kpiValue: "50",
    } });

    expect((await standings.read(projectId, OCTOBER_SO_FAR))?.kpi).toEqual({
      metric: "MANUAL", name: "Продажи", value: "50.0000", target: "40.0000",
    });
  });

  it("is nothing for a project without a KPI", async () => {
    expect(await standings.read(projectId, OCTOBER_SO_FAR)).toBeNull();
  });
});

describe("the monthly claim", () => {
  it("is won once per project and month", async () => {
    expect(await claims.claim(projectId, "2026-10-01")).toBe(true);
    expect(await claims.claim(projectId, "2026-10-01")).toBe(false);
    expect(await claims.claim(projectId, "2026-11-01")).toBe(true);
  });

  it("is won by one of two racing callers", async () => {
    const results = await Promise.all([claims.claim(projectId, "2026-10-01"), claims.claim(projectId, "2026-10-01")]);

    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it("leaves the project's update time alone", async () => {
    const before = (await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).updatedAt;

    await claims.claim(projectId, "2026-10-01");

    expect((await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).updatedAt).toEqual(before);
  });
});
