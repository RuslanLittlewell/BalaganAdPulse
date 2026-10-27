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
    .send({ projectId, title: "Созвон", priority: "MEDIUM", ...body });

const change = (id: string, body: Record<string, unknown>) =>
  request(app).patch(`/api/tasks/${id}`).set(admin).send(body);

describe("a task's time zone", () => {
  it("is the agency's when none is named", async () => {
    const res = await create({ dueDate: "2026-09-25", dueTime: "12:00" });

    expect(res.body).toMatchObject({ dueDate: "2026-09-25", dueTime: "12:00", timeZone: "Europe/Minsk" });
    expect((await prisma.task.findUniqueOrThrow({ where: { id: res.body.id } })).timeZone).toBeNull();
  });

  it("is the zone the request names", async () => {
    const res = await create({ dueDate: "2026-09-25", dueTime: "09:00", timeZone: "Europe/Warsaw" });

    expect(res.body).toMatchObject({ dueDate: "2026-09-25", dueTime: "09:00", timeZone: "Europe/Warsaw" });
  });

  it("stays when a change names none", async () => {
    const created = await create({ dueDate: "2026-09-25", dueTime: "10:00", timeZone: "Europe/Minsk" });

    expect((await change(created.body.id, { title: "Планёрка" })).body.timeZone).toBe("Europe/Minsk");
  });

  it("follows a new day and time set from another zone", async () => {
    const created = await create({ dueDate: "2026-09-25", dueTime: "10:00", timeZone: "Europe/Minsk" });

    const res = await change(created.body.id, { dueDate: "2026-09-25", dueTime: "09:00", timeZone: "Europe/Warsaw" });

    expect(res.body).toMatchObject({ dueTime: "09:00", timeZone: "Europe/Warsaw" });
  });

  it("refuses an unknown zone -> 400", async () => {
    const created = await create({ dueDate: "2026-09-25", dueTime: "10:00" });

    expect((await change(created.body.id, { dueTime: "11:00", timeZone: "Mars/Olympus" })).status).toBe(400);
    expect((await request(app).get(`/api/tasks/${created.body.id}`).set(admin)).body).toMatchObject({
      dueTime: "10:00", timeZone: "Europe/Minsk",
    });
  });
});
