import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { grantAccess, signInAs, type SignedIn } from "../helpers/auth.js";

const app = createApp();
let anna: SignedIn;
let boris: SignedIn;
let clientId: string;
let projectId: string;

beforeEach(async () => {
  await resetDb();
  anna = await signInAs("Анна");
  boris = await signInAs("Борис");
  ({ clientId, projectId } = await seedProject("unused", "Клиника"));
});

afterAll(() => prisma.$disconnect());

const notificationsOf = (member: SignedIn) =>
  prisma.notification.findMany({ where: { recipientId: member.membership!.id }, orderBy: { createdAt: "asc" } });

const seed = (member: SignedIn, count: number, readAt: Date | null = null) =>
  prisma.notification.createMany({
    data: Array.from({ length: count }, (_, index) => ({
      recipientId: member.membership!.id, kind: "KPI_MET" as const, projectId, readAt,
      createdAt: new Date(Date.UTC(2026, 9, 1, 0, index)),
    })),
  });

describe("reading one's notifications", () => {
  it("lists only the caller's latest fifty, newest first, with the unread count of all", async () => {
    await seed(anna, 55);
    await seed(anna, 5, new Date());
    await seed(boris, 3);

    const res = await request(app).get("/api/notifications").set(anna.auth);

    expect(res.status).toBe(200);
    expect(res.body.unreadCount).toBe(55);
    expect(res.body.notifications).toHaveLength(50);
    const times = res.body.notifications.map((n: { createdAt: string }) => n.createdAt);
    expect(times).toEqual([...times].sort().reverse());
    expect(res.body.notifications[0]).toEqual({
      id: expect.any(String), kind: "KPI_MET", createdAt: expect.any(String), readAt: null,
      project: { id: projectId, name: "Клиника" }, task: null, document: null, actor: null,
    });
  });

  it("marks one read, refuses someone else's with 404, and marks all read", async () => {
    await seed(anna, 2);
    await seed(boris, 1);
    const [first] = await notificationsOf(anna);
    const [theirs] = await notificationsOf(boris);

    expect((await request(app).post(`/api/notifications/${first!.id}/read`).set(anna.auth)).status).toBe(204);
    expect((await request(app).post(`/api/notifications/${theirs!.id}/read`).set(anna.auth)).status).toBe(404);
    expect((await request(app).get("/api/notifications").set(anna.auth)).body.unreadCount).toBe(1);
    expect((await request(app).get("/api/notifications").set(boris.auth)).body.unreadCount).toBe(1);

    expect((await request(app).post("/api/notifications/read-all").set(anna.auth)).status).toBe(204);
    expect((await request(app).get("/api/notifications").set(anna.auth)).body.unreadCount).toBe(0);
  });

  it("asks for a session", async () => {
    expect((await request(app).get("/api/notifications")).status).toBe(401);
  });
});

describe("what is notified", () => {
  it("tells the other admins and the client's managers of a new project, naming who added it", async () => {
    const manager = await signInAs("Вера", { role: "MANAGER" });
    await grantAccess(manager.membership!.id, clientId);
    const guest = await signInAs("Гость", { role: "GUEST" });

    const res = await request(app).post("/api/projects").set(anna.auth).send({ clientId, name: "Автосалон" });
    expect(res.status).toBe(201);

    await vi.waitFor(async () => {
      expect(await notificationsOf(boris)).toHaveLength(1);
      expect(await notificationsOf(manager)).toHaveLength(1);
    });
    const listed = (await request(app).get("/api/notifications").set(manager.auth)).body.notifications;
    expect(listed[0]).toMatchObject({ kind: "PROJECT_CREATED", project: { id: res.body.id, name: "Автосалон" }, actor: { name: "Анна" } });
    expect(await notificationsOf(anna)).toEqual([]);
    expect(await notificationsOf(guest)).toEqual([]);
  });

  it("tells a member named on a task, on creation and when added later, but not the one naming", async () => {
    const vera = await signInAs("Вера");

    const created = await request(app).post("/api/tasks").set(anna.auth)
      .send({ projectId, title: "Позвонить клиенту", priority: "MEDIUM", participantIds: [boris.membership!.id, anna.membership!.id] });
    expect(created.status).toBe(201);
    await vi.waitFor(async () => expect(await notificationsOf(boris)).toHaveLength(1));

    const updated = await request(app).patch(`/api/tasks/${created.body.id}`).set(anna.auth)
      .send({ participantIds: [boris.membership!.id, anna.membership!.id, vera.membership!.id] });
    expect(updated.status).toBe(200);
    await vi.waitFor(async () => {
      expect(await notificationsOf(vera)).toHaveLength(1);
      expect(await notificationsOf(boris)).toHaveLength(2);
    });

    const listed = (await request(app).get("/api/notifications").set(boris.auth)).body.notifications;
    expect(listed.map((n: { kind: string }) => n.kind)).toEqual(["TASK_UPDATED", "TASK_ASSIGNED"]);
    expect(listed[1]).toMatchObject({
      task: { id: created.body.id, title: "Позвонить клиенту", projectId }, actor: { name: "Анна" },
    });
    expect((await notificationsOf(vera)).map((n) => n.kind)).toEqual(["TASK_ASSIGNED"]);
    expect(await notificationsOf(anna)).toEqual([]);
  });

  it("tells a task's participants of a change, refreshing an unread one, and not of a reorder", async () => {
    const vera = await signInAs("Вера");
    const created = await request(app).post("/api/tasks").set(anna.auth)
      .send({ projectId, title: "Бриф", priority: "MEDIUM", participantIds: [boris.membership!.id, anna.membership!.id] });
    await vi.waitFor(async () => expect(await notificationsOf(boris)).toHaveLength(1));
    await prisma.notification.updateMany({ where: { recipientId: boris.membership!.id }, data: { readAt: new Date() } });

    await request(app).patch(`/api/tasks/${created.body.id}`).set(anna.auth).send({ title: "Бриф клиента" });
    await vi.waitFor(async () => expect((await notificationsOf(boris)).filter((n) => n.readAt === null)).toHaveLength(1));
    await request(app).post(`/api/tasks/${created.body.id}/move`).set(vera.auth).send({ column: "IN_PROGRESS", position: 0 });
    await vi.waitFor(async () => {
      const unread = (await notificationsOf(boris)).filter((n) => n.readAt === null);
      expect(unread).toHaveLength(1);
      expect(unread[0]).toMatchObject({ kind: "TASK_UPDATED", actorId: vera.membership!.id });
    });

    await prisma.notification.updateMany({ where: { recipientId: boris.membership!.id }, data: { readAt: new Date() } });
    await request(app).post(`/api/tasks/${created.body.id}/move`).set(vera.auth).send({ column: "IN_PROGRESS", position: 0 });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect((await notificationsOf(boris)).filter((n) => n.readAt === null)).toEqual([]);
    expect((await notificationsOf(anna)).map((n) => n.kind)).toEqual(["TASK_UPDATED"]);
  });

  it("tells the project's people of a new document, except the one who added it", async () => {
    const manager = await signInAs("Вера", { role: "MANAGER" });
    await grantAccess(manager.membership!.id, clientId);

    const res = await request(app).post(`/api/projects/${projectId}/documents`).set(manager.auth).send({ title: "Медиаплан" });
    expect(res.status).toBe(201);

    await vi.waitFor(async () => {
      expect(await notificationsOf(anna)).toHaveLength(1);
      expect(await notificationsOf(boris)).toHaveLength(1);
    });
    const listed = (await request(app).get("/api/notifications").set(anna.auth)).body.notifications;
    expect(listed[0]).toMatchObject({
      kind: "DOCUMENT_ADDED", project: { id: projectId, name: "Клиника" },
      document: { id: res.body.id, title: "Медиаплан" }, actor: { name: "Вера" },
    });
    expect(await notificationsOf(manager)).toEqual([]);
  });

  it("tells the project's people when a KPI set by hand is met, except the one who set it, once a month", async () => {
    const manager = await signInAs("Вера", { role: "MANAGER" });
    await grantAccess(manager.membership!.id, clientId);
    const customer = await signInAs("Клиент", { role: "CLIENT" });
    await grantAccess(customer.membership!.id, clientId);
    const kpi = { metric: "MANUAL", name: "Продажи", value: "50", target: "40" };

    expect((await request(app).put(`/api/projects/${projectId}/kpi`).set(manager.auth).send(kpi)).status).toBe(200);

    await vi.waitFor(async () => {
      expect(await notificationsOf(anna)).toHaveLength(1);
      expect(await notificationsOf(boris)).toHaveLength(1);
    });
    expect((await notificationsOf(anna))[0]).toMatchObject({ kind: "KPI_MET", projectId, actorId: null });
    expect(await notificationsOf(manager)).toEqual([]);
    expect(await notificationsOf(customer)).toEqual([]);

    await request(app).put(`/api/projects/${projectId}/kpi`).set(anna.auth).send({ ...kpi, value: "60" });
    await vi.waitFor(async () => {
      expect((await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).kpiMetMonth).not.toBeNull();
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(await notificationsOf(boris)).toHaveLength(1);
  });
});
