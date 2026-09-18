import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { grantAccess, signInAs } from "../helpers/auth.js";

const app = createApp();

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

const patch = (id: string, body: Record<string, unknown>) =>
  request(app).patch(`/api/tasks/${id}`).set(admin).send(body);

describe("a task's due date", () => {
  it("is absent on a task created without one", async () => {
    const res = await create();
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ dueDate: null, dueTime: null });
  });

  it("is stored as a day with no time of day", async () => {
    const res = await create({ dueDate: "2026-09-25" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ dueDate: "2026-09-25", dueTime: null });
  });

  it("is stored as a day with a time of day", async () => {
    const res = await create({ dueDate: "2026-09-25", dueTime: "12:00" });
    expect(res.body).toMatchObject({ dueDate: "2026-09-25", dueTime: "12:00" });
  });

  it("reads back the day it was given, as the day it was given", async () => {
    const created = await create({ dueDate: "2026-09-25" });
    const read = await request(app).get(`/api/tasks/${created.body.id}`).set(admin);
    expect(read.body.dueDate).toBe("2026-09-25");
    const stored = await prisma.task.findUniqueOrThrow({ where: { id: created.body.id } });
    expect(stored.dueDate?.toISOString()).toBe("2026-09-25T00:00:00.000Z");
  });

  it("refuses a time of day without a day -> 400", async () => {
    expect((await create({ dueTime: "12:00" })).status).toBe(400);
  });

  it("refuses a time of day on a task that has no day -> 400", async () => {
    const created = await create();
    expect((await patch(created.body.id, { dueTime: "12:00" })).status).toBe(400);
  });

  it("refuses a day that is not a calendar day -> 400", async () => {
    expect((await create({ dueDate: "25.09.2026" })).status).toBe(400);
  });

  it("refuses a time of day outside the clock -> 400", async () => {
    expect((await create({ dueDate: "2026-09-25", dueTime: "25:00" })).status).toBe(400);
  });

  it("is set on a task that had none, leaving its column and position", async () => {
    const first = await create({ column: "IN_REVIEW" });
    await create({ column: "IN_REVIEW" });

    const res = await patch(first.body.id, { dueDate: "2026-09-25", dueTime: "09:30" });
    expect(res.body).toMatchObject({
      dueDate: "2026-09-25", dueTime: "09:30", column: "IN_REVIEW", position: 0,
    });
  });

  it("is cleared together with its time of day", async () => {
    const created = await create({ dueDate: "2026-09-25", dueTime: "12:00" });
    const res = await patch(created.body.id, { dueDate: null });
    expect(res.body).toMatchObject({ dueDate: null, dueTime: null });
  });

  it("keeps its day when only the time of day is cleared", async () => {
    const created = await create({ dueDate: "2026-09-25", dueTime: "12:00" });
    const res = await patch(created.body.id, { dueTime: null });
    expect(res.body).toMatchObject({ dueDate: "2026-09-25", dueTime: null });
  });

  it("narrows the board to a range of due days on request", async () => {
    await create({ title: "Before", dueDate: "2026-09-13" });
    const monday = await create({ title: "Monday", dueDate: "2026-09-14" });
    const sunday = await create({ title: "Sunday", dueDate: "2026-09-20" });
    await create({ title: "After", dueDate: "2026-09-21" });
    await create({ title: "Undated" });

    const res = await request(app)
      .get("/api/tasks?dueFrom=2026-09-14&dueTo=2026-09-20").set(admin);
    expect(res.status).toBe(200);
    expect(res.body.map((task: { id: string }) => task.id).sort())
      .toEqual([monday.body.id, sunday.body.id].sort());
  });

  it("refuses a range that is not made of calendar days -> 400", async () => {
    expect((await request(app).get("/api/tasks?dueFrom=14.09.2026").set(admin)).status).toBe(400);
  });

  it("is refused to a guest -> 403", async () => {
    const guest = await signInAs("Guest", { role: "GUEST" });
    await grantAccess(guest.membership!.id, clientId);
    const created = await create({ assigneeId: guest.membership!.id });
    const res = await request(app).patch(`/api/tasks/${created.body.id}`)
      .set(guest.auth).send({ dueDate: "2026-09-25" });
    expect(res.status).toBe(403);
  });
});
