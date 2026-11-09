import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { grantAccess, signInAs, type SignedIn } from "../helpers/auth.js";

const app = createApp();

let admin: SignedIn;
let clientId: string;
let projectId: string;
let leadId: string;

beforeEach(async () => {
  await resetDb();
  admin = await signInAs("Admin", { role: "ADMIN" });
  ({ clientId, projectId } = await seedProject(admin.user.id, "Acme"));
  leadId = (await request(app).post(`/api/crm/boards/${projectId}/leads`).set(admin.auth).send({ name: "Анна" })).body.id;
});
afterAll(() => prisma.$disconnect());

const create = (body: Record<string, unknown> = {}, auth = admin.auth) =>
  request(app).post("/api/tasks").set(auth).send({ title: "Перезвонить", priority: "MEDIUM", dueDate: "2026-10-20", ...body });

describe("a task of a lead", () => {
  it("takes the project of its lead and carries the lead's name", async () => {
    const res = await create({ leadId });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      leadId, projectId, visibleToClient: false,
      lead: { id: leadId, name: "Анна", boardKey: projectId },
    });
  });

  it("refuses a project other than the lead's", async () => {
    const other = await seedProject(admin.user.id, "Другой");
    const res = await create({ leadId, projectId: other.projectId });

    expect(res.status).toBe(400);
    expect(await prisma.task.count()).toBe(0);
  });

  it("refuses to clear or change the lead afterwards", async () => {
    const created = await create({ leadId });

    const cleared = await request(app).patch(`/api/tasks/${created.body.id}`).set(admin.auth).send({ leadId: null });
    expect(cleared.status).toBe(400);
    const moved = await request(app).patch(`/api/tasks/${created.body.id}`).set(admin.auth).send({ projectId: null });
    expect(moved.status).toBe(400);
    const read = await request(app).get(`/api/tasks/${created.body.id}`).set(admin.auth);
    expect(read.body).toMatchObject({ leadId, projectId });
  });

  it("needs a day when it is created", async () => {
    const res = await create({ leadId, dueDate: null });

    expect(res.status).toBe(400);
    expect(await prisma.task.count()).toBe(0);
  });

  it("keeps its day: clearing it is refused and moving it is allowed", async () => {
    const created = await create({ leadId });

    const cleared = await request(app).patch(`/api/tasks/${created.body.id}`).set(admin.auth).send({ dueDate: null });
    expect(cleared.status).toBe(400);
    const moved = await request(app).patch(`/api/tasks/${created.body.id}`).set(admin.auth).send({ dueDate: "2026-10-22" });
    expect(moved.status).toBe(200);
    expect(moved.body.dueDate).toBe("2026-10-22");
  });

  it("still takes other changes", async () => {
    const created = await create({ leadId });
    const res = await request(app).patch(`/api/tasks/${created.body.id}`).set(admin.auth).send({ title: "Написать", leadId });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ title: "Написать", leadId });
  });

  it("is not shared with the client", async () => {
    const created = await create({ leadId });
    const res = await request(app).patch(`/api/tasks/${created.body.id}`).set(admin.auth).send({ visibleToClient: true });
    expect(res.status).toBe(400);
  });

  it("answers 404 for a lead the member does not reach", async () => {
    const manager = await signInAs("Manager", { role: "MANAGER" });
    const res = await create({ leadId }, manager.auth);
    expect(res.status).toBe(404);
  });

  it("is refused to a guest", async () => {
    const guest = await signInAs("Guest", { role: "GUEST" });
    await grantAccess(guest.membership!.id, clientId);
    expect((await create({ leadId }, guest.auth)).status).toBe(403);
  });

  it("is deleted with its lead", async () => {
    await create({ leadId });
    await create({ leadId, title: "Второй" });

    await request(app).delete(`/api/crm/boards/${projectId}/leads/${leadId}`).set(admin.auth);
    expect(await prisma.task.count()).toBe(0);
  });
});

describe("listing tasks of leads", () => {
  it("leaves them out of the default list", async () => {
    await create({ leadId });
    const plain = (await create({ projectId, title: "Обычная" })).body;

    const list = await request(app).get("/api/tasks").set(admin.auth);
    expect(list.body.map((task: { id: string }) => task.id)).toEqual([plain.id]);
  });

  it("lists only them for the crm scope", async () => {
    const onLead = (await create({ leadId })).body;
    await create({ projectId, title: "Обычная" });

    const list = await request(app).get("/api/tasks?scope=crm").set(admin.auth);
    expect(list.body.map((task: { id: string }) => task.id)).toEqual([onLead.id]);
  });

  it("narrows to one lead and to one board", async () => {
    const second = (await request(app).post(`/api/crm/boards/${projectId}/leads`).set(admin.auth).send({ name: "Борис" })).body.id;
    const first = (await create({ leadId })).body;
    await create({ leadId: second, title: "Борису" });

    const byLead = await request(app).get(`/api/tasks?leadId=${leadId}`).set(admin.auth);
    expect(byLead.body.map((task: { id: string }) => task.id)).toEqual([first.id]);
    const byBoard = await request(app).get(`/api/tasks?scope=crm&projectId=${projectId}`).set(admin.auth);
    expect(byBoard.body).toHaveLength(2);
  });
});
