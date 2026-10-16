import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { signInAs } from "../helpers/auth.js";

const app = createApp();

let admin: { Authorization: string };
let projectId: string;

beforeEach(async () => {
  await resetDb();
  const signedIn = await signInAs("Admin", { role: "ADMIN" });
  admin = signedIn.auth;
  ({ projectId } = await seedProject(signedIn.user.id, "Acme"));
});
afterAll(() => prisma.$disconnect());

const create = (body: Record<string, unknown> = {}) =>
  request(app).post("/api/tasks").set(admin)
    .send({ projectId, title: "T", priority: "MEDIUM", ...body });

const patch = (id: string, body: Record<string, unknown>) =>
  request(app).patch(`/api/tasks/${id}`).set(admin).send(body);

const read = (id: string) => request(app).get(`/api/tasks/${id}`).set(admin);

describe("the time a task ends", () => {
  it("is absent on a task given only a start", async () => {
    const res = await create({ dueDate: "2026-09-25", dueTime: "12:00" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ dueTime: "12:00", endTime: null });
  });

  it("is stored with the start and read back", async () => {
    const res = await create({ dueDate: "2026-09-25", dueTime: "12:00", endTime: "13:30" });
    expect(res.status).toBe(201);
    expect((await read(res.body.id)).body).toMatchObject({
      dueDate: "2026-09-25", dueTime: "12:00", endTime: "13:30",
    });
  });

  it("may run to the end of the day", async () => {
    const res = await create({ dueDate: "2026-09-25", dueTime: "22:00", endTime: "24:00" });
    expect(res.status).toBe(201);
    expect(res.body.endTime).toBe("24:00");
  });

  it("refuses an end without a start -> 400", async () => {
    expect((await create({ dueDate: "2026-09-25", endTime: "13:00" })).status).toBe(400);
  });

  it("refuses an end before the start, or at it -> 400", async () => {
    expect((await create({ dueDate: "2026-09-25", dueTime: "12:00", endTime: "11:00" })).status).toBe(400);
    expect((await create({ dueDate: "2026-09-25", dueTime: "12:00", endTime: "12:00" })).status).toBe(400);
  });

  it("refuses an end past the end of the day -> 400", async () => {
    expect((await create({ dueDate: "2026-09-25", dueTime: "23:00", endTime: "24:30" })).status).toBe(400);
    expect((await create({ dueDate: "2026-09-25", dueTime: "23:00", endTime: "01:00" })).status).toBe(400);
  });

  it("refuses an end on a task that has no start, leaving it unchanged -> 400", async () => {
    const created = await create({ dueDate: "2026-09-25" });
    expect((await patch(created.body.id, { endTime: "13:00" })).status).toBe(400);
    expect((await read(created.body.id)).body).toMatchObject({ dueTime: null, endTime: null });
  });

  it("keeps the length when only the start is moved", async () => {
    const created = await create({ dueDate: "2026-09-25", dueTime: "12:00", endTime: "13:30" });
    const res = await patch(created.body.id, { dueTime: "15:00" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ dueTime: "15:00", endTime: "16:30" });
  });

  it("keeps both times when only the day is moved", async () => {
    const created = await create({ dueDate: "2026-09-25", dueTime: "12:00", endTime: "13:30" });
    const res = await patch(created.body.id, { dueDate: "2026-09-26", dueTime: "12:00" });
    expect(res.body).toMatchObject({ dueDate: "2026-09-26", dueTime: "12:00", endTime: "13:30" });
  });

  it("refuses a moved start that carries the end past the day, leaving the task unchanged -> 400", async () => {
    const created = await create({ dueDate: "2026-09-25", dueTime: "12:00", endTime: "14:00" });
    expect((await patch(created.body.id, { dueTime: "23:00" })).status).toBe(400);
    expect((await read(created.body.id)).body).toMatchObject({ dueTime: "12:00", endTime: "14:00" });
  });

  it("is cleared with the start", async () => {
    const created = await create({ dueDate: "2026-09-25", dueTime: "12:00", endTime: "13:00" });
    const res = await patch(created.body.id, { dueTime: null });
    expect(res.body).toMatchObject({ dueDate: "2026-09-25", dueTime: null, endTime: null });
  });

  it("is cleared with the due date, leaving the column and position", async () => {
    const created = await create({ column: "IN_REVIEW", dueDate: "2026-09-25", dueTime: "12:00", endTime: "13:00" });
    const res = await patch(created.body.id, { dueDate: null });
    expect(res.body).toMatchObject({
      dueDate: null, dueTime: null, endTime: null, column: "IN_REVIEW", position: 0,
    });
  });

  it("survives completing a repeating task", async () => {
    const created = await create({
      dueDate: "2026-09-16", dueTime: "12:00", endTime: "13:00", repeatEvery: "WEEKLY",
    });
    const res = await request(app).post(`/api/tasks/${created.body.id}/complete`).set(admin).send({});
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ dueDate: "2026-09-23", dueTime: "12:00", endTime: "13:00" });
  });
});
