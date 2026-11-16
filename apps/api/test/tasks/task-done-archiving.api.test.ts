import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { createContainer } from "../../src/composition/create-container.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { signInAs } from "../helpers/auth.js";

const container = createContainer();
const app = createApp({ container });

const HOUR_MS = 60 * 60 * 1000;

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

const stored = (id: string) => prisma.task.findUniqueOrThrow({ where: { id } });

const doneHoursAgo = (id: string, hours: number) =>
  prisma.task.update({ where: { id }, data: { doneAt: new Date(Date.now() - hours * HOUR_MS) } });

const archiveDoneTasks = async () => {
  container.doneArchiveWorker.start();
  await container.doneArchiveWorker.stop();
};

describe("the queue column", () => {
  it("holds a task created into it", async () => {
    const created = await create({ column: "QUEUED" });

    expect(created.status).toBe(201);
    expect(created.body.column).toBe("QUEUED");
  });

  it("takes a task moved into it", async () => {
    const created = await create();

    const res = await move(created.body.id, "QUEUED");

    expect(res.status).toBe(200);
    expect(res.body.column).toBe("QUEUED");
  });

  it("is listed right after the ideas", async () => {
    await create({ column: "IN_PROGRESS", title: "В работе" });
    await create({ column: "QUEUED", title: "В очереди" });
    await create({ column: "IDEA", title: "Идея" });

    const res = await request(app).get("/api/tasks").set(admin);

    expect(res.body.map((task: { column: string }) => task.column))
      .toEqual(["IDEA", "QUEUED", "IN_PROGRESS"]);
  });
});

describe("when a task was done", () => {
  it("is stamped when the task enters DONE", async () => {
    const created = await create();
    const before = Date.now();

    await move(created.body.id, "DONE");

    const { doneAt } = await stored(created.body.id);
    expect(doneAt).not.toBeNull();
    expect(doneAt!.getTime()).toBeGreaterThanOrEqual(before - 1000);
  });

  it("is stamped on a task created straight into DONE", async () => {
    const created = await create({ column: "DONE" });

    expect((await stored(created.body.id)).doneAt).not.toBeNull();
  });

  it("stays when another task is reordered in DONE", async () => {
    const first = await create({ column: "DONE" });
    const second = await create();
    await doneHoursAgo(first.body.id, 5);
    const stamped = (await stored(first.body.id)).doneAt;

    await move(second.body.id, "DONE", 0);

    expect((await stored(first.body.id)).doneAt).toEqual(stamped);
  });

  it("is cleared when the task leaves DONE", async () => {
    const created = await create({ column: "DONE" });

    await move(created.body.id, "IN_PROGRESS");

    expect((await stored(created.body.id)).doneAt).toBeNull();
  });
});

describe("archiving done tasks", () => {
  it("moves a task done a day ago to the top of the archive", async () => {
    const archivedEarlier = await create({ column: "ARCHIVED" });
    const stale = await create({ column: "DONE" });
    const fresh = await create({ column: "DONE" });
    await doneHoursAgo(stale.body.id, 25);

    await archiveDoneTasks();

    const task = await stored(stale.body.id);
    expect(task.column).toBe("ARCHIVED");
    expect(task.position).toBe(0);
    expect(task.archivedAt).not.toBeNull();
    expect(task.doneAt).toBeNull();
    expect((await stored(archivedEarlier.body.id)).position).toBe(1);
    expect(await stored(fresh.body.id)).toMatchObject({ column: "DONE", position: 0 });
  });

  it("leaves a task done three hours ago in DONE", async () => {
    const created = await create({ column: "DONE" });
    await doneHoursAgo(created.body.id, 3);

    await archiveDoneTasks();

    expect((await stored(created.body.id)).column).toBe("DONE");
  });

  it("leaves a task that was reopened before its day passed", async () => {
    const created = await create({ column: "DONE" });
    await doneHoursAgo(created.body.id, 20);
    await move(created.body.id, "IN_PROGRESS");

    await archiveDoneTasks();

    expect((await stored(created.body.id)).column).toBe("IN_PROGRESS");
  });

  it("writes no audit event", async () => {
    const created = await create({ column: "DONE" });
    await doneHoursAgo(created.body.id, 25);
    const before = await prisma.auditEvent.count();

    await archiveDoneTasks();

    expect(await prisma.auditEvent.count()).toBe(before);
  });
});
