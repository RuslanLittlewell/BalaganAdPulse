import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { grantAccess, signInAs, type SignedIn } from "../helpers/auth.js";

const app = createApp();

let admin: SignedIn;
let client: SignedIn;
let clientId: string;
let projectId: string;

const create = (auth: SignedIn["auth"], body: Record<string, unknown> = {}) =>
  request(app).post("/api/tasks").set(auth).send({ title: "Позвонить бухгалтеру", priority: "MEDIUM", ...body });

async function customer(name: string, role: "CLIENT" | "CLIENT_ADMIN" = "CLIENT") {
  const signedIn = await signInAs(name, { role });
  await grantAccess(signedIn.membership!.id, clientId);
  return signedIn;
}

async function personalTask() {
  const res = await create(client.auth, { dueDate: "2026-10-30" });
  expect(res.status).toBe(201);
  return res.body as { id: string };
}

beforeEach(async () => {
  await resetDb();
  admin = await signInAs("Admin", { role: "ADMIN" });
  ({ clientId, projectId } = await seedProject(admin.user.id, "Acme"));
  client = await customer("Клиент");
});
afterAll(() => prisma.$disconnect());

describe("a client's task with no project", () => {
  it("is stored as theirs and is on their board", async () => {
    const created = await create(client.auth);

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ projectId: null, personal: true, visibleToClient: false, participantIds: [] });
    const board = await request(app).get("/api/tasks").set(client.auth);
    expect(board.body.map((task: { id: string }) => task.id)).toEqual([created.body.id]);
  });

  it("is reached by nobody else, not even an admin", async () => {
    const task = await personalTask();
    const manager = await signInAs("Manager", { role: "MANAGER" });
    await grantAccess(manager.membership!.id, clientId);
    const colleague = await customer("Коллега");
    const principal = await customer("Главный", "CLIENT_ADMIN");

    for (const other of [admin, manager, colleague, principal]) {
      expect((await request(app).get(`/api/tasks/${task.id}`).set(other.auth)).status).toBe(404);
      const board = await request(app).get("/api/tasks").set(other.auth);
      expect(board.body.map((shown: { id: string }) => shown.id)).not.toContain(task.id);
    }
  });

  it("leaves a client's task on a project shared with the client as before", async () => {
    const created = await create(client.auth, { projectId });

    expect(created.body).toMatchObject({ projectId, personal: false, visibleToClient: true });
    expect((await request(app).get(`/api/tasks/${created.body.id}`).set(admin.auth)).status).toBe(200);
  });

  it("is a manager's own note as before, which admins still see", async () => {
    const manager = await signInAs("Manager", { role: "MANAGER" });
    const created = await create(manager.auth);

    expect(created.body.personal).toBe(false);
    expect((await request(app).get(`/api/tasks/${created.body.id}`).set(admin.auth)).status).toBe(200);
  });
});

describe("the author of a personal task", () => {
  it("renames it, reschedules it and changes its checklist", async () => {
    const task = await personalTask();

    const res = await request(app).patch(`/api/tasks/${task.id}`).set(client.auth).send({
      title: "Позвонить в налоговую", dueDate: "2026-11-02", checklist: [{ title: "Найти номер" }],
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ title: "Позвонить в налоговую", dueDate: "2026-11-02", checklist: [{ title: "Найти номер" }] });
  });

  it("moves it to Готово", async () => {
    const task = await personalTask();

    const res = await request(app).post(`/api/tasks/${task.id}/move`).set(client.auth).send({ column: "DONE", position: 0 });

    expect(res.status).toBe(200);
    expect(res.body.column).toBe("DONE");
  });

  it("completes it when it repeats", async () => {
    const task = (await create(client.auth, { dueDate: "2026-10-30", repeatEvery: "WEEKLY" })).body;

    const res = await request(app).post(`/api/tasks/${task.id}/complete`).set(client.auth);

    expect(res.status).toBe(200);
    expect(res.body.dueDate).toBe("2026-11-06");
  });

  it("deletes it", async () => {
    const task = await personalTask();

    expect((await request(app).delete(`/api/tasks/${task.id}`).set(client.auth)).status).toBe(204);
    expect(await prisma.task.count()).toBe(0);
  });

  it("cannot give it a project", async () => {
    const task = await personalTask();

    const res = await request(app).patch(`/api/tasks/${task.id}`).set(client.auth).send({ projectId });

    expect(res.status).toBe(400);
    expect((await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).projectId).toBeNull();
  });

  it("names nobody on it and does not mark it shared", async () => {
    const task = await personalTask();

    expect((await request(app).patch(`/api/tasks/${task.id}`).set(client.auth)
      .send({ participantIds: [admin.membership!.id] })).status).toBe(403);
    expect((await request(app).patch(`/api/tasks/${task.id}`).set(client.auth)
      .send({ visibleToClient: true })).status).toBe(403);
  });

  it("still may not change a task on a project", async () => {
    const shared = (await create(client.auth, { projectId })).body;

    expect((await request(app).patch(`/api/tasks/${shared.id}`).set(client.auth).send({ title: "Иначе" })).status).toBe(403);
    expect((await request(app).delete(`/api/tasks/${shared.id}`).set(client.auth)).status).toBe(403);
  });
});

describe("the activity log", () => {
  it("records nothing of a personal task", async () => {
    const task = await personalTask();
    await request(app).patch(`/api/tasks/${task.id}`).set(client.auth).send({ title: "Иначе" });
    await request(app).post(`/api/tasks/${task.id}/move`).set(client.auth).send({ column: "DONE", position: 0 });
    await request(app).delete(`/api/tasks/${task.id}`).set(client.auth);

    expect(await prisma.auditEvent.count({ where: { entityType: "task" } })).toBe(0);
  });
});
