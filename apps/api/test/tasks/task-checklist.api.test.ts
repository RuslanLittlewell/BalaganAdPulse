import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { grantAccess, signInAs } from "../helpers/auth.js";

const app = createApp();
const MISSING = "00000000-0000-0000-0000-000000000000";

interface ChecklistItem { id: string; title: string; done: boolean; position: number }

let admin: { Authorization: string };
let projectId: string;
let clientId: string;

beforeEach(async () => {
  await resetDb();
  const signedIn = await signInAs("Admin", { role: "ADMIN" });
  admin = signedIn.auth;
  ({ clientId, projectId } = await seedProject(signedIn.user.id, "Acme"));
});
afterAll(() => prisma.$disconnect());

const create = (body: Record<string, unknown> = {}) =>
  request(app).post("/api/tasks").set(admin)
    .send({ projectId, title: "T", priority: "MEDIUM", ...body });

const add = (taskId: string, title: string, auth = admin) =>
  request(app).post(`/api/tasks/${taskId}/checklist`).set(auth).send({ title });

const tick = (taskId: string, itemId: string, body: Record<string, unknown>, auth = admin) =>
  request(app).patch(`/api/tasks/${taskId}/checklist/${itemId}`).set(auth).send(body);

async function taskWithThreeItems() {
  const task = await create({ column: "IN_PROGRESS" });
  const items: ChecklistItem[] = [];
  for (const title of ["Собрать креативы", "Согласовать бюджет", "Запустить"]) {
    const res = await add(task.body.id, title);
    items.push(res.body.checklist.at(-1) as ChecklistItem);
  }
  return { taskId: task.body.id as string, items };
}

describe("a checklist given when the task is created", () => {
  it("is stored with the task, in order and unticked", async () => {
    const res = await create({
      checklist: [{ title: "Повестка" }, { title: "Запись" }, { title: "Итоги" }],
    });

    expect(res.status).toBe(201);
    expect(res.body.checklist).toMatchObject([
      { title: "Повестка", done: false, position: 0 },
      { title: "Запись", done: false, position: 1 },
      { title: "Итоги", done: false, position: 2 },
    ]);
  });

  it("is empty on a task created without one", async () => {
    expect((await create()).body.checklist).toEqual([]);
  });

  it("refuses the whole creation for a blank item title -> 400", async () => {
    const res = await create({ checklist: [{ title: "Повестка" }, { title: "   " }] });

    expect(res.status).toBe(400);
    expect(await prisma.task.count()).toBe(0);
    expect(await prisma.taskChecklistItem.count()).toBe(0);
  });

  it("leaves no item behind when the creation is refused", async () => {
    const stranger = await signInAs("Stranger", { role: "MANAGER" });
    const res = await request(app).post("/api/tasks").set(stranger.auth)
      .send({ projectId, title: "T", priority: "MEDIUM", checklist: [{ title: "Повестка" }] });

    expect(res.status).toBe(404);
    expect(await prisma.taskChecklistItem.count()).toBe(0);
  });

  it("comes back with the task when the board is read", async () => {
    await create({ checklist: [{ title: "Повестка" }, { title: "Запись" }] });

    const board = await request(app).get("/api/tasks").set(admin);
    expect(board.body[0].checklist).toHaveLength(2);
    expect(board.body[0].checklist.filter((item: ChecklistItem) => item.done)).toHaveLength(0);
  });

  it("goes with the task when it is deleted", async () => {
    const created = await create({ checklist: [{ title: "Повестка" }] });
    await request(app).delete(`/api/tasks/${created.body.id}`).set(admin);
    expect(await prisma.taskChecklistItem.count()).toBe(0);
  });

  it("is refused to a member who may not create a task -> 403", async () => {
    const guest = await signInAs("Guest", { role: "GUEST" });
    await grantAccess(guest.membership!.id, clientId);
    const res = await request(app).post("/api/tasks").set(guest.auth)
      .send({ projectId, title: "T", priority: "MEDIUM", checklist: [{ title: "Повестка" }] });

    expect(res.status).toBe(403);
    expect(await prisma.taskChecklistItem.count()).toBe(0);
  });
});

describe("a checklist given when the task is updated", () => {
  async function taskOfThree() {
    const created = await create({
      checklist: [{ title: "Повестка" }, { title: "Запись" }, { title: "Итоги" }],
    });
    return created.body as { id: string; checklist: ChecklistItem[] };
  }

  const patch = (id: string, body: Record<string, unknown>, auth = admin) =>
    request(app).patch(`/api/tasks/${id}`).set(auth).send(body);

  it("replaces the stored list with the one it is given", async () => {
    const task = await taskOfThree();
    const res = await patch(task.id, {
      checklist: [{ title: "Запись", done: true }, { title: "Повестка" }],
    });

    expect(res.status).toBe(200);
    expect(res.body.checklist).toMatchObject([
      { title: "Запись", done: true, position: 0 },
      { title: "Повестка", done: false, position: 1 },
    ]);
    expect(await prisma.taskChecklistItem.count()).toBe(2);
  });

  it("leaves the checklist alone when the update names none", async () => {
    const task = await taskOfThree();
    const res = await patch(task.id, { title: "Созвон" });

    expect(res.body.title).toBe("Созвон");
    expect(res.body.checklist.map((item: ChecklistItem) => item.title))
      .toEqual(["Повестка", "Запись", "Итоги"]);
  });

  it("empties the checklist when the update names an empty one", async () => {
    const task = await taskOfThree();
    const res = await patch(task.id, { checklist: [] });

    expect(res.body.checklist).toEqual([]);
    expect(await prisma.taskChecklistItem.count()).toBe(0);
  });

  it("refuses the whole update for a blank item title -> 400", async () => {
    const task = await taskOfThree();
    const res = await patch(task.id, { title: "Созвон", checklist: [{ title: " " }] });

    expect(res.status).toBe(400);
    const after = await request(app).get(`/api/tasks/${task.id}`).set(admin);
    expect(after.body.title).toBe("T");
    expect(after.body.checklist).toHaveLength(3);
  });

  it("keeps the card where it is", async () => {
    const first = await create({ column: "IN_PROGRESS" });
    await create({ column: "IN_PROGRESS" });
    const res = await patch(first.body.id, { checklist: [{ title: "Повестка", done: true }] });

    expect(res.body).toMatchObject({ column: "IN_PROGRESS", position: 0 });
  });

  it("is refused to a guest -> 403", async () => {
    const guest = await signInAs("Guest", { role: "GUEST" });
    await grantAccess(guest.membership!.id, clientId);
    const created = await create({
      assigneeId: guest.membership!.id, checklist: [{ title: "Повестка" }],
    });

    expect((await patch(created.body.id, { checklist: [] }, guest.auth)).status).toBe(403);
    expect(await prisma.taskChecklistItem.count()).toBe(1);
  });

  it("writes one audit event for the update", async () => {
    const task = await taskOfThree();
    const before = await prisma.auditEvent.count({ where: { entityId: task.id } });
    await patch(task.id, { checklist: [{ title: "Повестка" }] });
    expect(await prisma.auditEvent.count({ where: { entityId: task.id } })).toBe(before + 1);
  });
});

describe("a checklist item on its own", () => {
  it("has no route of its own", async () => {
    const created = await create({ checklist: [{ title: "Повестка" }] });
    const itemId = created.body.checklist[0].id;

    expect((await request(app).post(`/api/tasks/${created.body.id}/checklist`)
      .set(admin).send({ title: "Ещё" })).status).toBe(404);
    expect((await request(app).patch(`/api/tasks/${created.body.id}/checklist/${itemId}`)
      .set(admin).send({ done: true })).status).toBe(404);
    expect((await request(app).delete(`/api/tasks/${created.body.id}/checklist/${itemId}`)
      .set(admin)).status).toBe(404);
    expect((await request(app).post(`/api/tasks/${created.body.id}/checklist/reorder`)
      .set(admin).send({ ids: [itemId] })).status).toBe(404);
  });
});
