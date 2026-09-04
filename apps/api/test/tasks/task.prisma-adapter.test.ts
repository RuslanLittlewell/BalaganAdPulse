import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Prisma } from "@prisma/client";
import {
  PrismaTaskMemberReach,
  PrismaTaskProjectReach,
  PrismaTaskRepository,
} from "../../src/modules/tasks/infrastructure/prisma-task-repository.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { PrismaUnitOfWork } from "../../src/shared/infrastructure/prisma-unit-of-work.js";
import { resetDb, seedCampaign, seedProject } from "../helpers/db.js";
import { currentOrg, grantAccess, signInAs, signInAsOutsider } from "../helpers/auth.js";

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

function adapters() {
  const unitOfWork = new PrismaUnitOfWork<Prisma.TransactionClient>(prisma);
  return {
    unitOfWork,
    tasks: new PrismaTaskRepository(prisma, unitOfWork),
    projects: new PrismaTaskProjectReach(prisma),
    members: new PrismaTaskMemberReach(prisma),
  };
}

const uuid = (n: number) => `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-a${String(n).repeat(3)}-${String(n).repeat(12)}`;

async function scenario() {
  const admin = await signInAs("Admin", { role: "ADMIN" });
  const { clientId, projectId } = await seedProject(admin.user.id, "Acme");
  const org = await currentOrg();
  return { admin, clientId, projectId, orgId: org.id };
}

async function assigned(orgId: string, projectId: string, id: string, assigneeId: string) {
  return prisma.task.create({
    data: { id, orgId, projectId, title: id, priority: "LOW", column: "IDEA", position: 0, assigneeId },
  });
}

async function seedTask(orgId: string, projectId: string, id: string, column: Parameters<typeof prisma.task.create>[0]["data"]["column"], position: number) {
  return prisma.task.create({
    data: { id, orgId, projectId, title: id, priority: "LOW", column, position },
  });
}

describe("Prisma task repository", () => {
  it("stores a task with its structured description", async () => {
    const { unitOfWork, tasks } = adapters();
    const { orgId, projectId } = await scenario();
    const description = { type: "doc", content: [] };

    const created = await unitOfWork.run((context) => tasks.create(context, {
      id: uuid(1), projectId, orgId, title: "T", description,
      column: "IDEA", priority: "HIGH", assigneeId: null, createdById: null, position: 0,
    }));
    expect(created).toMatchObject({ title: "T", column: "IDEA", priority: "HIGH", description });
  });

  describe("reach translation", () => {
    it("shows an admin every task of the organization and nothing beyond it", async () => {
      const { tasks } = adapters();
      const { admin, orgId, projectId } = await scenario();
      await seedTask(orgId, projectId, uuid(2), "IDEA", 0);
      const outsider = await signInAsOutsider();
      const theirProject = await prisma.project.create({
        data: { clientId: outsider.client.id, name: "Theirs", position: 0 },
      });
      await prisma.task.create({
        data: { id: uuid(3), orgId: outsider.org.id, projectId: theirProject.id, title: "Theirs", priority: "LOW", position: 0 },
      });

      expect((await tasks.listReachable(admin.actor!)).map((t) => t.id)).toEqual([uuid(2)]);
      expect(await tasks.findReachable(admin.actor!, uuid(3))).toBeNull();
    });

    it("gives a whole-client grant every task of that client's projects", async () => {
      const { tasks } = adapters();
      const { clientId, orgId, projectId } = await scenario();
      const manager = await signInAs("Manager", { role: "MANAGER" });
      await assigned(orgId, projectId, uuid(4), manager.membership!.id);

      expect(await tasks.listReachable(manager.actor!)).toEqual([]);
      await grantAccess(manager.membership!.id, clientId);
      expect((await tasks.listReachable(manager.actor!)).map((t) => t.id)).toEqual([uuid(4)]);
    });

    it("narrows a project-scoped grant to that project's tasks alone", async () => {
      const { tasks } = adapters();
      const { clientId, orgId, projectId } = await scenario();
      const second = await prisma.project.create({ data: { clientId, name: "Second", position: 1 } });
      const manager = await signInAs("Manager", { role: "MANAGER" });
      await assigned(orgId, projectId, uuid(5), manager.membership!.id);
      await assigned(orgId, second.id, uuid(6), manager.membership!.id);
      await grantAccess(manager.membership!.id, clientId, projectId);

      expect((await tasks.listReachable(manager.actor!)).map((t) => t.id)).toEqual([uuid(5)]);
      expect(await tasks.findReachable(manager.actor!, uuid(6))).toBeNull();
    });
  });

  it("reads the board column-major, in the order the columns are drawn", async () => {
    const { tasks } = adapters();
    const { admin, orgId, projectId } = await scenario();
    await seedTask(orgId, projectId, uuid(7), "DONE", 0);
    await seedTask(orgId, projectId, uuid(8), "IDEA", 1);
    await seedTask(orgId, projectId, uuid(9), "ARCHIVED", 0);
    await seedTask(orgId, projectId, uuid(1), "IDEA", 0);

    expect((await tasks.listReachable(admin.actor!)).map((t) => t.id))
      .toEqual([uuid(1), uuid(8), uuid(9), uuid(7)]);
  });

  it("counts a column so a new task can be appended", async () => {
    const { tasks } = adapters();
    const { orgId, projectId } = await scenario();
    await seedTask(orgId, projectId, uuid(2), "IN_REVIEW", 0);
    expect(await tasks.countInColumn(orgId, "IN_REVIEW")).toBe(1);
    expect(await tasks.countInColumn(orgId, "DONE")).toBe(0);
  });

  it("writes a column's order back densely from zero", async () => {
    const { unitOfWork, tasks } = adapters();
    const { orgId, projectId } = await scenario();
    await seedTask(orgId, projectId, uuid(3), "IDEA", 0);
    await seedTask(orgId, projectId, uuid(4), "IDEA", 1);
    await seedTask(orgId, projectId, uuid(5), "IDEA", 2);

    await unitOfWork.run((context) =>
      tasks.applyOrder(context, "IDEA", [uuid(5), uuid(3), uuid(4)]));

    expect(await tasks.columnIds(orgId, "IDEA")).toEqual([uuid(5), uuid(3), uuid(4)]);
    const rows = await prisma.task.findMany({ where: { orgId }, orderBy: { position: "asc" } });
    expect(rows.map((row) => row.position)).toEqual([0, 1, 2]);
  });

  it("moves a card between columns as part of applying an order", async () => {
    const { unitOfWork, tasks } = adapters();
    const { orgId, projectId } = await scenario();
    await seedTask(orgId, projectId, uuid(6), "IDEA", 0);

    await unitOfWork.run((context) => tasks.applyOrder(context, "DONE", [uuid(6)]));
    const moved = await prisma.task.findUniqueOrThrow({ where: { id: uuid(6) } });
    expect(moved).toMatchObject({ column: "DONE", position: 0 });
  });

  it("leaves the board untouched when the transaction fails", async () => {
    const { unitOfWork, tasks } = adapters();
    const { orgId, projectId } = await scenario();
    await seedTask(orgId, projectId, uuid(7), "IDEA", 0);
    await seedTask(orgId, projectId, uuid(8), "IDEA", 1);

    await expect(unitOfWork.run(async (context) => {
      await tasks.applyOrder(context, "IDEA", [uuid(8), uuid(7)]);
      throw new Error("the rest of the operation failed");
    })).rejects.toThrow("the rest of the operation failed");

    expect(await tasks.columnIds(orgId, "IDEA")).toEqual([uuid(7), uuid(8)]);
  });
});

describe("Prisma project and member reach", () => {
  it("answers the client a reachable project belongs to, and nothing otherwise", async () => {
    const { projects } = adapters();
    const { admin, clientId, projectId } = await scenario();
    const manager = await signInAs("Manager", { role: "MANAGER" });

    expect(await projects.contextFor(admin.actor!, projectId)).toEqual({ clientId });
    expect(await projects.contextFor(manager.actor!, projectId)).toBeNull();
  });

  it("accepts an active member of the same organization as assignable", async () => {
    const { members } = adapters();
    const { admin } = await scenario();
    const member = await signInAs("Member", { role: "MANAGER" });
    expect(await members.isAssignable(admin.actor!, member.membership!.id)).toBe(true);
  });

  it("refuses a suspended member and one from another organization", async () => {
    const { members } = adapters();
    const { admin } = await scenario();
    const dormant = await signInAs("Dormant", { role: "MANAGER", status: "SUSPENDED" });
    const outsider = await signInAsOutsider();

    expect(await members.isAssignable(admin.actor!, dormant.membership!.id)).toBe(false);
    expect(await members.isAssignable(admin.actor!, outsider.membership.id)).toBe(false);
  });
});

describe("a task's campaign", () => {
  it("stores a task against a campaign of its project", async () => {
    const { unitOfWork, tasks } = adapters();
    const { orgId, projectId } = await scenario();
    const campaign = await seedCampaign(projectId, "Поиск / Москва");

    const created = await unitOfWork.run((context) => tasks.create(context, {
      id: uuid(1), projectId, orgId, title: "Переписать объявления",
      column: "IDEA", priority: "HIGH", assigneeId: null, createdById: null,
      campaignId: campaign.id, position: 0,
    }));

    expect(created.campaignId).toBe(campaign.id);
  });

  it("stores a task with no campaign", async () => {
    const { unitOfWork, tasks } = adapters();
    const { orgId, projectId } = await scenario();

    const created = await unitOfWork.run((context) => tasks.create(context, {
      id: uuid(2), projectId, orgId, title: "Согласовать бюджет",
      column: "IDEA", priority: "LOW", assigneeId: null, createdById: null,
      campaignId: null, position: 0,
    }));

    expect(created.campaignId).toBeNull();
  });

  it("attaches and releases a campaign on update", async () => {
    const { unitOfWork, tasks } = adapters();
    const { orgId, projectId } = await scenario();
    const campaign = await seedCampaign(projectId, "Лента");
    await seedTask(orgId, projectId, uuid(3), "IDEA", 0);

    const attached = await unitOfWork.run((context) =>
      tasks.update(context, uuid(3), { campaignId: campaign.id }));
    expect(attached.campaignId).toBe(campaign.id);

    const released = await unitOfWork.run((context) =>
      tasks.update(context, uuid(3), { campaignId: null }));
    expect(released.campaignId).toBeNull();
  });

  it("leaves the campaign alone when the update does not mention it", async () => {
    const { unitOfWork, tasks } = adapters();
    const { orgId, projectId } = await scenario();
    const campaign = await seedCampaign(projectId, "Лента");
    await prisma.task.create({
      data: { id: uuid(4), orgId, projectId, title: "T", priority: "LOW",
              column: "IDEA", position: 0, campaignId: campaign.id },
    });

    const renamed = await unitOfWork.run((context) =>
      tasks.update(context, uuid(4), { title: "Другое" }));

    expect(renamed.campaignId).toBe(campaign.id);
  });

  it("leaves tasks standing when their campaign is deleted", async () => {
    const { orgId, projectId } = await scenario();
    const campaign = await seedCampaign(projectId, "Лента");
    await prisma.task.createMany({ data: [
      { id: uuid(5), orgId, projectId, title: "A", priority: "LOW", column: "IDEA", position: 0, campaignId: campaign.id },
      { id: uuid(6), orgId, projectId, title: "B", priority: "LOW", column: "IDEA", position: 1, campaignId: campaign.id },
    ] });

    await prisma.campaign.delete({ where: { id: campaign.id } });

    const surviving = await prisma.task.findMany({ where: { projectId }, orderBy: { position: "asc" } });
    expect(surviving.map((task) => task.title)).toEqual(["A", "B"]);
    expect(surviving.every((task) => task.campaignId === null)).toBe(true);
  });
});

describe("whether a task is shown to the client", () => {
  it("stores a task as the agency's own by default", async () => {
    const { unitOfWork, tasks } = adapters();
    const { orgId, projectId } = await scenario();

    const created = await unitOfWork.run((context) => tasks.create(context, {
      id: uuid(7), projectId, orgId, title: "Внутренняя заметка",
      column: "IDEA", priority: "LOW", assigneeId: null, createdById: null,
      campaignId: null, visibleToClient: false, position: 0,
    }));

    expect(created.visibleToClient).toBe(false);
  });

  it("stores a task that is shown to the client", async () => {
    const { unitOfWork, tasks } = adapters();
    const { orgId, projectId } = await scenario();

    const created = await unitOfWork.run((context) => tasks.create(context, {
      id: uuid(8), projectId, orgId, title: "Заявка клиента",
      column: "IDEA", priority: "LOW", assigneeId: null, createdById: null,
      campaignId: null, visibleToClient: true, position: 0,
    }));

    expect(created.visibleToClient).toBe(true);
  });

  it("shares and unshares an existing task", async () => {
    const { unitOfWork, tasks } = adapters();
    const { orgId, projectId } = await scenario();
    await seedTask(orgId, projectId, uuid(9), "IDEA", 0);

    const shared = await unitOfWork.run((context) =>
      tasks.update(context, uuid(9), { visibleToClient: true }));
    expect(shared.visibleToClient).toBe(true);

    const taken = await unitOfWork.run((context) =>
      tasks.update(context, uuid(9), { visibleToClient: false }));
    expect(taken.visibleToClient).toBe(false);
  });

  it("leaves the responsible member and the stage untouched when sharing", async () => {
    const { unitOfWork, tasks } = adapters();
    const { admin, orgId, projectId } = await scenario();
    await prisma.task.create({
      data: { id: uuid(10), orgId, projectId, title: "T", priority: "HIGH",
              column: "IN_REVIEW", position: 3, assigneeId: admin.membership!.id },
    });

    const shared = await unitOfWork.run((context) =>
      tasks.update(context, uuid(10), { visibleToClient: true }));

    expect(shared).toMatchObject({
      assigneeId: admin.membership!.id, column: "IN_REVIEW", priority: "HIGH", position: 3,
    });
  });

  it("leaves the mark alone when the update does not mention it", async () => {
    const { unitOfWork, tasks } = adapters();
    const { orgId, projectId } = await scenario();
    await prisma.task.create({
      data: { id: uuid(11), orgId, projectId, title: "T", priority: "LOW",
              column: "IDEA", position: 0, visibleToClient: true },
    });

    const renamed = await unitOfWork.run((context) =>
      tasks.update(context, uuid(11), { title: "Другое" }));

    expect(renamed.visibleToClient).toBe(true);
  });
});

describe("whose tasks a member sees", () => {
  async function board() {
    const admin = await signInAs("Admin", { role: "ADMIN" });
    const { clientId, projectId } = await seedProject(admin.user.id, "Acme");
    const org = await currentOrg();
    const manager = await signInAs("Manager", { role: "MANAGER" });
    await grantAccess(manager.membership!.id, clientId);
    const other = await signInAs("Other", { role: "MANAGER" });
    await grantAccess(other.membership!.id, clientId);
    const customer = await signInAs("Customer", { role: "CLIENT" });
    await grantAccess(customer.membership!.id, clientId);

    const make = (id: string, data: Record<string, unknown>) => prisma.task.create({
      data: {
        id, orgId: org.id, projectId, title: id, priority: "LOW", column: "IDEA",
        position: 0, ...data,
      },
    });
    await make(uuid(1), { assigneeId: manager.membership!.id });
    await make(uuid(2), { assigneeId: other.membership!.id });
    await make(uuid(3), { assigneeId: null });
    await make(uuid(4), { visibleToClient: true, createdById: customer.membership!.id });

    return { admin, manager, other, customer };
  }

  it("shows an admin everything in the organization", async () => {
    const { tasks } = adapters();
    const { admin } = await board();

    expect(await tasks.listReachable(admin.actor!)).toHaveLength(4);
  });

  it("shows a manager only what they are responsible for", async () => {
    const { tasks } = adapters();
    const { manager } = await board();

    expect((await tasks.listReachable(manager.actor!)).map((t) => t.id)).toEqual([uuid(1)]);
  });

  it("hides a task nobody is responsible for from a manager", async () => {
    const { tasks } = adapters();
    const { manager, admin } = await board();

    expect((await tasks.listReachable(manager.actor!)).map((t) => t.id)).not.toContain(uuid(3));
    expect((await tasks.listReachable(admin.actor!)).map((t) => t.id)).toContain(uuid(3));
  });

  it("shows a manager a task once an admin makes them responsible", async () => {
    const { unitOfWork, tasks } = adapters();
    const { manager } = await board();

    await unitOfWork.run((context) =>
      tasks.update(context, uuid(3), { assigneeId: manager.membership!.id }));

    expect((await tasks.listReachable(manager.actor!)).map((t) => t.id)).toContain(uuid(3));
  });

  it("shows a client only what is marked as shown to them", async () => {
    const { tasks } = adapters();
    const { customer } = await board();

    expect((await tasks.listReachable(customer.actor!)).map((t) => t.id)).toEqual([uuid(4)]);
  });

  it("answers nothing for one task the member cannot see", async () => {
    const { tasks } = adapters();
    const { manager, customer } = await board();

    expect(await tasks.findReachable(manager.actor!, uuid(2))).toBeNull();
    expect(await tasks.findReachable(customer.actor!, uuid(1))).toBeNull();
  });

  it("still answers for a task the member can see", async () => {
    const { tasks } = adapters();
    const { manager, customer } = await board();

    expect(await tasks.findReachable(manager.actor!, uuid(1))).not.toBeNull();
    expect(await tasks.findReachable(customer.actor!, uuid(4))).not.toBeNull();
  });

  it("never shows a task in a project the member cannot reach", async () => {
    const { tasks } = adapters();
    const { manager } = await board();
    const stranger = await signInAs("Stranger", { role: "MANAGER" });
    const org = await currentOrg();
    const elsewhere = await seedProject(stranger.user.id, "Elsewhere");
    await prisma.task.create({
      data: {
        id: uuid(5), orgId: org.id, projectId: elsewhere.projectId, title: "Их",
        priority: "LOW", column: "IDEA", position: 0, assigneeId: manager.membership!.id,
      },
    });

    expect((await tasks.listReachable(manager.actor!)).map((t) => t.id)).not.toContain(uuid(5));
  });
});
