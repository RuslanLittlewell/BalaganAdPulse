import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import {
  PrismaDueTasks,
  PrismaKpiMonthClaims,
  PrismaNotificationRecipients,
  PrismaNotificationRepository,
  PrismaProjectKpiStandings,
} from "../../src/modules/notifications/infrastructure/prisma-notifications.js";
import { PrismaMetricRepository } from "../../src/modules/campaigns/infrastructure/prisma-metric-repository.js";
import { resetDb, seedCampaign, seedProject } from "../helpers/db.js";
import { grantAccess, signInAs, signInAsOutsider } from "../helpers/auth.js";

const repository = new PrismaNotificationRepository(prisma);
const recipients = new PrismaNotificationRecipients(prisma);
const standings = new PrismaProjectKpiStandings(prisma, new PrismaMetricRepository(prisma));
const claims = new PrismaKpiMonthClaims(prisma);
const dueTasks = new PrismaDueTasks(prisma);

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
    await prisma.projectKpi.create({ data: { projectId, position: 0, metric: "CONVERSIONS", target: "62", updatedAt: new Date() } });
    const campaign = await seedCampaign(projectId);
    const day = (date: string, conversions: number, spend: number) =>
      ({ campaignId: campaign.id, date: new Date(`${date}T00:00:00Z`), conversions, spend });
    await prisma.campaignDailyMetric.createMany({ data: [
      day("2026-09-30", 100, 900), day("2026-10-01", 10, 100), day("2026-10-15", 20, 200), day("2026-10-16", 100, 900),
    ] });

    const [standing] = await standings.read(projectId, OCTOBER_SO_FAR);

    expect(standing?.kpi).toEqual({ metric: "CONVERSIONS", target: "62.0000" });
    expect(standing?.figures).toMatchObject({ conversions: 30, spend: 300, cpa: 10 });
  });

  it("measures a KPI naming an account on that account's campaigns alone", async () => {
    const base = { projectId, target: "62", updatedAt: new Date() };
    await prisma.projectKpi.createMany({ data: [
      { ...base, position: 0, metric: "CONVERSIONS", channel: "META", sourceAccountId: "act_1" },
      { ...base, position: 1, metric: "CONVERSIONS" },
    ] });
    const first = await prisma.campaign.create({ data: { projectId, name: "Первый", channel: "META", sourceAccountId: "act_1", position: 0 } });
    const second = await prisma.campaign.create({ data: { projectId, name: "Второй", channel: "META", sourceAccountId: "act_2", position: 1 } });
    await prisma.campaignDailyMetric.createMany({ data: [
      { campaignId: first.id, date: new Date("2026-10-05T00:00:00Z"), conversions: 40, spend: 400 },
      { campaignId: second.id, date: new Date("2026-10-05T00:00:00Z"), conversions: 30, spend: 300 },
    ] });

    const [own, common] = await standings.read(projectId, OCTOBER_SO_FAR);

    expect(own?.figures).toMatchObject({ conversions: 40, spend: 400 });
    expect(common?.figures).toMatchObject({ conversions: 70, spend: 700 });
  });

  it("reads a KPI set by hand with its name and value", async () => {
    await prisma.projectKpi.create({ data: {
      projectId, position: 0, metric: "MANUAL", target: "40", name: "Продажи", value: "50", updatedAt: new Date(),
    } });

    expect((await standings.read(projectId, OCTOBER_SO_FAR)).map(({ kpi }) => kpi)).toEqual([{
      metric: "MANUAL", name: "Продажи", value: "50.0000", target: "40.0000",
    }]);
  });

  it("reads every enabled KPI in order and none that is switched off", async () => {
    const base = { projectId, target: "10", updatedAt: new Date() };
    await prisma.projectKpi.createMany({ data: [
      { ...base, position: 0, metric: "CONVERSIONS" },
      { ...base, position: 1, metric: "CPA", enabled: false },
      { ...base, position: 2, metric: "SPEND" },
    ] });

    expect((await standings.read(projectId, OCTOBER_SO_FAR)).map(({ kpi }) => kpi.metric)).toEqual(["CONVERSIONS", "SPEND"]);
  });

  it("reads a KPI on one result type with the project's results by type", async () => {
    await prisma.projectKpi.create({ data: {
      projectId, position: 0, metric: "RESULTS", target: "300", resultType: "MESSAGES", updatedAt: new Date(),
    } });
    const campaign = await seedCampaign(projectId, "Сообщения", "META");
    const adSet = await prisma.adSet.create({ data: { campaignId: campaign.id, name: "Группа", optimizationGoal: "CONVERSATIONS", position: 0 } });
    await prisma.adSetDailyMetric.create({ data: { adSetId: adSet.id, date: new Date("2026-10-05T00:00:00Z"), results: 150, spend: 3000 } });
    await prisma.adSetDailyMetric.create({ data: { adSetId: adSet.id, date: new Date("2026-09-30T00:00:00Z"), results: 999, spend: 1 } });

    const [standing] = await standings.read(projectId, OCTOBER_SO_FAR);

    expect(standing?.kpi).toEqual({ metric: "RESULTS", target: "300.0000", resultType: "MESSAGES" });
    expect(standing?.figures.resultTypes).toEqual([{ type: "MESSAGES", results: 150, spend: 3000 }]);
  });

  it("is nothing for a project whose KPIs are not tracked", async () => {
    await prisma.projectKpi.create({ data: { projectId, position: 0, metric: "CONVERSIONS", target: "62", updatedAt: new Date() } });
    await prisma.project.update({ where: { id: projectId }, data: { kpiTracked: false } });

    expect(await standings.read(projectId, OCTOBER_SO_FAR)).toEqual([]);
  });

  it("is nothing when every KPI is switched off", async () => {
    await prisma.projectKpi.create({ data: { projectId, position: 0, metric: "CPA", target: "10", enabled: false, updatedAt: new Date() } });

    expect(await standings.read(projectId, OCTOBER_SO_FAR)).toEqual([]);
  });

  it("is nothing for a project without a KPI", async () => {
    expect(await standings.read(projectId, OCTOBER_SO_FAR)).toEqual([]);
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

describe("refreshing an unread notification", () => {
  it("brings the recipient's unread one about the same task up to date, and leaves read ones alone", async () => {
    const anna = await signInAs("Анна");
    const vera = await signInAs("Вера");
    const boris = await membershipOf("Борис");
    const task = await prisma.task.create({ data: {
      orgId: anna.membership!.orgId, projectId, title: "Бриф", priority: "MEDIUM", position: 0,
    } });
    const draft = (actorId: string) => ({
      recipientId: boris, kind: "TASK_UPDATED" as const, projectId, taskId: task.id, documentId: null, actorId,
    });
    const at = new Date("2026-10-15T12:00:00Z");

    expect(await repository.refreshUnread(draft(anna.membership!.id), at)).toBeNull();
    const [first] = await repository.createMany([draft(anna.membership!.id)]);
    const refreshed = await repository.refreshUnread(draft(vera.membership!.id), at);

    expect(refreshed).toMatchObject({ id: first!.id, recipientId: boris, actor: { name: "Вера" }, createdAt: at });
    await repository.markRead(boris, first!.id, at);
    expect(await repository.refreshUnread(draft(anna.membership!.id), at)).toBeNull();
  });
});

describe("tasks with a due date", () => {
  const seedTask = async (partial: Record<string, unknown> = {}) => {
    const org = await prisma.organization.findFirstOrThrow({ orderBy: { createdAt: "asc" } });
    return prisma.task.create({ data: {
      orgId: org.id, projectId, title: "Бриф", priority: "MEDIUM", position: 0,
      dueDate: new Date("2026-10-20T00:00:00Z"), dueTime: "18:00", ...partial,
    } });
  };

  it("are found by due day with their participants, outside Готово and Архив", async () => {
    const boris = await membershipOf("Борис");
    const open = await seedTask({ participants: { create: [{ membershipId: boris }] } });
    await seedTask({ column: "DONE" });
    await seedTask({ column: "ARCHIVED" });
    await seedTask({ dueDate: new Date("2026-10-22T00:00:00Z") });
    await seedTask({ dueDate: null, dueTime: null });

    expect(await dueTasks.dueBetween("2026-10-19", "2026-10-20")).toEqual([{
      id: open.id, projectId, dueDate: "2026-10-20", dueTime: "18:00",
      createdById: null, visibleToClient: false, participantIds: [boris],
    }]);
  });

  it("leave out organizations without the tasks module", async () => {
    await seedTask();
    const org = await prisma.organization.findFirstOrThrow({ orderBy: { createdAt: "asc" } });
    await prisma.organization.update({ where: { id: org.id }, data: { modules: ["CRM"] } });

    expect(await dueTasks.dueBetween("2026-10-19", "2026-10-20")).toEqual([]);
  });

  it("are claimed once per deadline, and again for a new one", async () => {
    const task = await seedTask();
    const deadline = new Date("2026-10-20T15:00:00Z");

    expect(await dueTasks.claim(task.id, deadline)).toBe(true);
    expect(await dueTasks.claim(task.id, deadline)).toBe(false);
    expect((await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).dueSoonFor).toEqual(deadline);
    expect(await dueTasks.claim(task.id, new Date("2026-10-22T15:00:00Z"))).toBe(true);
  });
});
