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

const WEEKLY_AT_TEN = { dueDate: "2026-10-19", dueTime: "10:00", repeatEvery: "WEEKLY" };

const create = (body: Record<string, unknown> = {}) =>
  request(app).post("/api/tasks").set(admin)
    .send({ projectId, title: "Планёрка", priority: "MEDIUM", ...body });

const change = (id: string, body: Record<string, unknown>) =>
  request(app).patch(`/api/tasks/${id}`).set(admin).send(body);

const read = async (id: string) => (await request(app).get(`/api/tasks/${id}`).set(admin)).body;

describe("a call", () => {
  it("is not a call by default", async () => {
    expect((await create(WEEKLY_AT_TEN)).body.isCall).toBe(false);
  });

  it("is a repeating task with a time marked as a call", async () => {
    const res = await create({ ...WEEKLY_AT_TEN, isCall: true });

    expect(res.status).toBe(201);
    expect(await read(res.body.id)).toMatchObject({ ...WEEKLY_AT_TEN, isCall: true });
  });

  it("refuses a call that does not repeat -> 400", async () => {
    const res = await create({ dueDate: "2026-10-19", dueTime: "10:00", isCall: true });

    expect(res.status).toBe(400);
    expect(await prisma.task.count()).toBe(0);
  });

  it("refuses a call with no time -> 400", async () => {
    expect((await create({ dueDate: "2026-10-19", repeatEvery: "WEEKLY", isCall: true })).status).toBe(400);
  });

  it("refuses marking an existing one-off task as a call -> 400", async () => {
    const created = await create({ dueDate: "2026-10-19", dueTime: "10:00" });

    expect((await change(created.body.id, { isCall: true })).status).toBe(400);
    expect((await read(created.body.id)).isCall).toBe(false);
  });

  it("ends when its repetition is stopped", async () => {
    const created = await create({ ...WEEKLY_AT_TEN, isCall: true });

    const res = await change(created.body.id, { repeatEvery: "NONE" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ repeatEvery: "NONE", isCall: false });
  });

  it("is unmarked on request", async () => {
    const created = await create({ ...WEEKLY_AT_TEN, isCall: true });

    expect((await change(created.body.id, { isCall: false })).body.isCall).toBe(false);
  });

  it("stays a call when completed into its next week", async () => {
    const created = await create({ ...WEEKLY_AT_TEN, isCall: true });

    const res = await request(app).post(`/api/tasks/${created.body.id}/complete`).set(admin).send({});

    expect(res.body).toMatchObject({ dueDate: "2026-10-26", isCall: true });
  });
});
