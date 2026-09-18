import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { grantAccess, signInAs } from "../helpers/auth.js";

const app = createApp();
const MISSING = "00000000-0000-0000-0000-000000000000";

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
    .send({ projectId, title: "Созвон", priority: "MEDIUM", ...body });

const complete = (id: string, auth = admin) =>
  request(app).post(`/api/tasks/${id}/complete`).set(auth).send({});

describe("a repeating task", () => {
  it("is not repeating by default", async () => {
    expect((await create()).body.repeatEvery).toBe("NONE");
  });

  it("repeats on an interval once it has a due date", async () => {
    const res = await create({ dueDate: "2026-09-16", dueTime: "12:00", repeatEvery: "WEEKLY" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      dueDate: "2026-09-16", dueTime: "12:00", repeatEvery: "WEEKLY",
    });
  });

  it("refuses an interval without a due date -> 400", async () => {
    expect((await create({ repeatEvery: "WEEKLY" })).status).toBe(400);
  });

  it("refuses an interval set on a task that has no due date -> 400", async () => {
    const created = await create();
    const res = await request(app).patch(`/api/tasks/${created.body.id}`)
      .set(admin).send({ repeatEvery: "WEEKLY" });
    expect(res.status).toBe(400);
    expect((await request(app).get(`/api/tasks/${created.body.id}`).set(admin)).body.repeatEvery)
      .toBe("NONE");
  });

  it("refuses having its due date cleared while it repeats -> 400", async () => {
    const created = await create({ dueDate: "2026-09-16", repeatEvery: "WEEKLY" });
    const res = await request(app).patch(`/api/tasks/${created.body.id}`)
      .set(admin).send({ dueDate: null });

    expect(res.status).toBe(400);
    const after = await request(app).get(`/api/tasks/${created.body.id}`).set(admin);
    expect(after.body).toMatchObject({ dueDate: "2026-09-16", repeatEvery: "WEEKLY" });
  });

  it("stops repeating and keeps its due date", async () => {
    const created = await create({ dueDate: "2026-09-16", repeatEvery: "WEEKLY" });
    const res = await request(app).patch(`/api/tasks/${created.body.id}`)
      .set(admin).send({ repeatEvery: "NONE" });
    expect(res.body).toMatchObject({ dueDate: "2026-09-16", repeatEvery: "NONE" });
  });

  it("refuses an unknown interval -> 400", async () => {
    expect((await create({ dueDate: "2026-09-16", repeatEvery: "FORTNIGHTLY" })).status).toBe(400);
  });
});

describe("completing a repeating task", () => {
  it("moves it to its next occurrence, keeping the time of day", async () => {
    const created = await create({
      dueDate: "2026-09-16", dueTime: "12:00", repeatEvery: "WEEKLY", column: "IN_PROGRESS",
    });
    const res = await complete(created.body.id);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: created.body.id, dueDate: "2026-09-23", dueTime: "12:00", repeatEvery: "WEEKLY",
    });
  });

  it("creates no second task", async () => {
    const created = await create({ dueDate: "2026-09-16", repeatEvery: "WEEKLY" });
    await complete(created.body.id);
    expect(await prisma.task.count()).toBe(1);
  });

  it("leaves the card in its column and at its position", async () => {
    const first = await create({ dueDate: "2026-09-16", repeatEvery: "WEEKLY", column: "IN_PROGRESS" });
    const second = await create({ column: "IN_PROGRESS" });
    const res = await complete(first.body.id);

    expect(res.body).toMatchObject({ column: "IN_PROGRESS", position: 0 });
    const neighbour = await request(app).get(`/api/tasks/${second.body.id}`).set(admin);
    expect(neighbour.body).toMatchObject({ column: "IN_PROGRESS", position: 1 });
  });

  it("unticks every item of its checklist and keeps them all", async () => {
    const created = await create({
      dueDate: "2026-09-16",
      repeatEvery: "WEEKLY",
      checklist: [
        { title: "Повестка", done: true },
        { title: "Запись", done: true },
        { title: "Итоги", done: true },
      ],
    });
    expect(created.body.checklist.map((item: { done: boolean }) => item.done))
      .toEqual([true, true, true]);

    const res = await complete(created.body.id);
    expect(res.body.checklist.map((item: { title: string }) => item.title))
      .toEqual(["Повестка", "Запись", "Итоги"]);
    expect(res.body.checklist.map((item: { done: boolean }) => item.done))
      .toEqual([false, false, false]);
  });

  it("keeps everything else about the task", async () => {
    const member = await signInAs("Member", { role: "MANAGER" });
    const created = await create({
      dueDate: "2026-09-16", repeatEvery: "WEEKLY", priority: "HIGH",
      assigneeId: member.membership!.id, description: { type: "doc", content: [] },
    });
    const res = await complete(created.body.id);

    expect(res.body).toMatchObject({
      title: "Созвон", priority: "HIGH", assigneeId: member.membership!.id, projectId,
      description: { type: "doc", content: [] },
    });
  });

  it("counts from the task's own due date, however late it is completed", async () => {
    const created = await create({ dueDate: "2020-03-04", repeatEvery: "WEEKLY" });
    expect((await complete(created.body.id)).body.dueDate).toBe("2020-03-11");
  });

  it("falls on the last day of a month too short to hold it", async () => {
    const created = await create({ dueDate: "2026-01-31", repeatEvery: "MONTHLY" });
    expect((await complete(created.body.id)).body.dueDate).toBe("2026-02-28");
  });

  it("refuses a task that does not repeat -> 400", async () => {
    const created = await create({ dueDate: "2026-09-16" });
    const res = await complete(created.body.id);

    expect(res.status).toBe(400);
    expect((await request(app).get(`/api/tasks/${created.body.id}`).set(admin)).body.dueDate)
      .toBe("2026-09-16");
  });

  it("refuses a guest -> 403", async () => {
    const guest = await signInAs("Guest", { role: "GUEST" });
    await grantAccess(guest.membership!.id, clientId);
    const created = await create({
      dueDate: "2026-09-16", repeatEvery: "WEEKLY", assigneeId: guest.membership!.id,
    });

    expect((await complete(created.body.id, guest.auth)).status).toBe(403);
    expect((await request(app).get(`/api/tasks/${created.body.id}`).set(admin)).body.dueDate)
      .toBe("2026-09-16");
  });

  it("answers 404 for a task out of reach, the same as for a missing one", async () => {
    const created = await create({ dueDate: "2026-09-16", repeatEvery: "WEEKLY" });
    const stranger = await signInAs("Stranger", { role: "MANAGER" });

    expect((await complete(created.body.id, stranger.auth)).status).toBe(404);
    expect((await complete(MISSING, stranger.auth)).status).toBe(404);
  });

  it("records the move in the audit trail, naming both days", async () => {
    const created = await create({ dueDate: "2026-09-16", repeatEvery: "WEEKLY" });
    await complete(created.body.id);

    const event = await prisma.auditEvent.findFirstOrThrow({
      where: { entityId: created.body.id }, orderBy: { createdAt: "desc" },
    });
    expect(event.summary).toContain("2026-09-16");
    expect(event.summary).toContain("2026-09-23");
  });
});
