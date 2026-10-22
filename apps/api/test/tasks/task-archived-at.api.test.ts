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
    .send({ projectId, title: "Задача", priority: "MEDIUM", ...body });

const move = (id: string, column: string, position = 0) =>
  request(app).post(`/api/tasks/${id}/move`).set(admin).send({ column, position });

const archivedAtOf = async (id: string) =>
  (await prisma.task.findUniqueOrThrow({ where: { id } })).archivedAt;

describe("when a task was archived", () => {
  it("is empty for a task outside the archive", async () => {
    const created = await create();
    expect(created.body.archivedAt).toBeNull();
  });

  it("is stamped when the task enters the archive column", async () => {
    const created = await create();
    const before = Date.now();

    const res = await move(created.body.id, "ARCHIVED");

    expect(res.body.archivedAt).not.toBeNull();
    expect(new Date(res.body.archivedAt).getTime()).toBeGreaterThanOrEqual(before - 1000);
  });

  it("is stamped on a task created straight into the archive", async () => {
    const created = await create({ column: "ARCHIVED" });
    expect(created.body.archivedAt).not.toBeNull();
  });

  it("stays when another task is reordered in the archive", async () => {
    const first = await create();
    const second = await create();
    await move(first.body.id, "ARCHIVED");
    const stamped = await archivedAtOf(first.body.id);
    await prisma.task.update({
      where: { id: first.body.id }, data: { archivedAt: new Date("2026-01-01T00:00:00.000Z") },
    });

    await move(second.body.id, "ARCHIVED", 0);

    expect(stamped).not.toBeNull();
    expect((await archivedAtOf(first.body.id))?.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("is cleared when the task leaves the archive", async () => {
    const created = await create();
    await move(created.body.id, "ARCHIVED");

    const res = await move(created.body.id, "IN_PROGRESS");

    expect(res.body.archivedAt).toBeNull();
    expect(await archivedAtOf(created.body.id)).toBeNull();
  });
});
