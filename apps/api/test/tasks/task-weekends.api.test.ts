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
    .send({ projectId, title: "Отчёт", priority: "MEDIUM", ...body });

const change = (id: string, body: Record<string, unknown>) =>
  request(app).patch(`/api/tasks/${id}`).set(admin).send(body);

const complete = (id: string) => request(app).post(`/api/tasks/${id}/complete`).set(admin).send({});

describe("a task that skips weekends", () => {
  it("does not skip them by default", async () => {
    expect((await create({ dueDate: "2026-10-23", repeatEvery: "DAILY" })).body.skipWeekends).toBe(false);
  });

  it("is completed from Friday into Monday, keeping its time", async () => {
    const created = await create({ dueDate: "2026-10-23", dueTime: "10:00", repeatEvery: "DAILY", skipWeekends: true });

    expect((await complete(created.body.id)).body).toMatchObject({ dueDate: "2026-10-26", dueTime: "10:00" });
  });

  it("leaves out a monthly occurrence on a Sunday", async () => {
    const created = await create({ dueDate: "2026-10-15", repeatEvery: "MONTHLY", skipWeekends: true });

    expect((await complete(created.body.id)).body.dueDate).toBe("2026-12-15");
  });

  it("is saved on a Saturday as due the Monday after", async () => {
    const res = await create({ dueDate: "2026-10-24", repeatEvery: "DAILY", skipWeekends: true });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ dueDate: "2026-10-26", skipWeekends: true });
  });

  it("moves a weekly Sunday to Mondays", async () => {
    const created = await create({ dueDate: "2026-10-25", repeatEvery: "WEEKLY", skipWeekends: true });

    expect(created.body.dueDate).toBe("2026-10-26");
    expect((await complete(created.body.id)).body.dueDate).toBe("2026-11-02");
  });

  it("refuses to skip weekends without a repetition -> 400", async () => {
    const created = await create({ dueDate: "2026-10-23" });

    expect((await change(created.body.id, { skipWeekends: true })).status).toBe(400);
    expect((await request(app).get(`/api/tasks/${created.body.id}`).set(admin)).body.skipWeekends).toBe(false);
  });

  it("stops skipping when it stops repeating", async () => {
    const created = await create({ dueDate: "2026-10-23", repeatEvery: "DAILY", skipWeekends: true });

    const res = await change(created.body.id, { repeatEvery: "NONE" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ repeatEvery: "NONE", skipWeekends: false });
  });
});
