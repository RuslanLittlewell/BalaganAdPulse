import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { grantAccess, signInAs, type SignedIn } from "../helpers/auth.js";

const app = createApp();
const MISSING = "00000000-0000-0000-0000-000000000000";

let admin: SignedIn;
let manager: SignedIn;
let colleague: SignedIn;
let customer: SignedIn;
let projectId: string;

beforeEach(async () => {
  await resetDb();
  admin = await signInAs("Admin", { role: "ADMIN" });
  const seeded = await seedProject(admin.user.id, "Acme");
  projectId = seeded.projectId;
  manager = await signInAs("Manager", { role: "MANAGER" });
  colleague = await signInAs("Colleague", { role: "MANAGER" });
  customer = await signInAs("Customer", { role: "CLIENT" });
  for (const member of [manager, colleague, customer]) {
    await grantAccess(member.membership!.id, seeded.clientId);
  }
});
afterAll(() => prisma.$disconnect());

const idOf = (member: SignedIn) => member.membership!.id;

const create = async (body: Record<string, unknown> = {}) =>
  (await request(app).post("/api/tasks").set(admin.auth)
    .send({ projectId, title: "Макет", priority: "MEDIUM", participantIds: [idOf(manager), idOf(colleague)], ...body })).body.id as string;

const comment = (by: SignedIn, taskId: string, body: Record<string, unknown>) =>
  request(app).post(`/api/tasks/${taskId}/comments`).set(by.auth).send(body);

const list = (by: SignedIn, taskId: string) =>
  request(app).get(`/api/tasks/${taskId}/comments`).set(by.auth);

const mentionsOf = (member: SignedIn) =>
  prisma.notification.findMany({ where: { recipientId: idOf(member), kind: "TASK_MENTIONED" } });

describe("the comments of a task", () => {
  it("start empty", async () => {
    const taskId = await create();
    const res = await list(manager, taskId);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("list what was written, oldest first, with its author", async () => {
    const taskId = await create();
    await comment(manager, taskId, { body: "Первый" });
    await comment(colleague, taskId, { body: "Второй" });

    const res = await list(admin, taskId);

    expect(res.body.map((c: { body: string }) => c.body)).toEqual(["Первый", "Второй"]);
    expect(res.body[0]).toMatchObject({ authorId: idOf(manager), mentionIds: [] });
  });

  it("trim the text", async () => {
    const taskId = await create();
    expect((await comment(manager, taskId, { body: "  Привет \n" })).body.body).toBe("Привет");
  });

  it("refuse an empty comment -> 400", async () => {
    const taskId = await create();
    expect((await comment(manager, taskId, { body: "   " })).status).toBe(400);
  });

  it("refuse a comment over the limit -> 400", async () => {
    const taskId = await create();
    expect((await comment(manager, taskId, { body: "я".repeat(5001) })).status).toBe(400);
  });

  it("are not reachable for a task the member cannot see -> 404", async () => {
    const taskId = await create({ participantIds: [idOf(colleague)] });
    expect((await list(manager, taskId)).status).toBe(404);
    expect((await comment(manager, taskId, { body: "Привет" })).status).toBe(404);
  });

  it("are not reachable for a missing task -> 404", async () => {
    expect((await list(admin, MISSING)).status).toBe(404);
  });

  it("go with the task", async () => {
    const taskId = await create();
    await comment(manager, taskId, { body: "Привет" });

    await request(app).delete(`/api/tasks/${taskId}`).set(admin.auth);

    expect(await prisma.taskComment.count({ where: { taskId } })).toBe(0);
  });
});

describe("deleting a comment", () => {
  it("is the author's to do", async () => {
    const taskId = await create();
    const written = await comment(manager, taskId, { body: "Моё" });

    const res = await request(app).delete(`/api/tasks/${taskId}/comments/${written.body.id}`).set(manager.auth);

    expect(res.status).toBe(204);
    expect((await list(manager, taskId)).body).toEqual([]);
  });

  it("is an admin's to do", async () => {
    const taskId = await create();
    const written = await comment(manager, taskId, { body: "Чужое" });

    const res = await request(app).delete(`/api/tasks/${taskId}/comments/${written.body.id}`).set(admin.auth);

    expect(res.status).toBe(204);
  });

  it("is refused to anyone else -> 403", async () => {
    const taskId = await create();
    const written = await comment(manager, taskId, { body: "Чужое" });

    const res = await request(app).delete(`/api/tasks/${taskId}/comments/${written.body.id}`).set(colleague.auth);

    expect(res.status).toBe(403);
    expect((await list(manager, taskId)).body).toHaveLength(1);
  });

  it("reports a missing comment -> 404", async () => {
    const taskId = await create();
    expect((await request(app).delete(`/api/tasks/${taskId}/comments/${MISSING}`).set(admin.auth)).status).toBe(404);
  });
});

describe("tagging in a comment", () => {
  it("is kept on the comment and notifies the tagged member", async () => {
    const taskId = await create();

    const res = await comment(manager, taskId, { body: "@Colleague глянь", mentionIds: [idOf(colleague)] });

    expect(res.status).toBe(201);
    expect(res.body.mentionIds).toEqual([idOf(colleague)]);
    await vi.waitFor(async () => {
      const mentions = await mentionsOf(colleague);
      expect(mentions).toHaveLength(1);
      expect(mentions[0]).toMatchObject({ taskId, actorId: idOf(manager) });
    });
  });

  it("tells a member about each comment that tags them", async () => {
    const taskId = await create();
    await comment(manager, taskId, { body: "@Colleague раз", mentionIds: [idOf(colleague)] });
    await comment(manager, taskId, { body: "@Colleague два", mentionIds: [idOf(colleague)] });

    await vi.waitFor(async () => expect(await mentionsOf(colleague)).toHaveLength(2));
  });

  it("does not notify the author who tags themselves", async () => {
    const taskId = await create();
    await comment(manager, taskId, { body: "@Manager", mentionIds: [idOf(manager)] });
    await comment(manager, taskId, { body: "и ещё", mentionIds: [idOf(colleague)] });

    await vi.waitFor(async () => expect(await mentionsOf(colleague)).toHaveLength(1));
    expect(await mentionsOf(manager)).toHaveLength(0);
  });

  it("counts a member tagged twice once", async () => {
    const taskId = await create();
    const res = await comment(manager, taskId, { body: "@C @C", mentionIds: [idOf(colleague), idOf(colleague)] });

    expect(res.body.mentionIds).toEqual([idOf(colleague)]);
  });

  it("refuses someone who is not a member of the organization -> 400", async () => {
    const taskId = await create();
    expect((await comment(manager, taskId, { body: "@кто-то", mentionIds: [MISSING] })).status).toBe(400);
  });

  it("refuses a client's person on a task not shared with the client -> 400", async () => {
    const taskId = await create();
    expect((await comment(manager, taskId, { body: "@Customer", mentionIds: [idOf(customer)] })).status).toBe(400);
  });

  it("lets a client's person be tagged on a shared task they reach", async () => {
    const taskId = await create({ participantIds: [idOf(manager)] });
    await request(app).patch(`/api/tasks/${taskId}`).set(admin.auth).send({ visibleToClient: true });

    const res = await comment(manager, taskId, { body: "@Customer", mentionIds: [idOf(customer)] });

    expect(res.status).toBe(201);
    await vi.waitFor(async () => expect(await mentionsOf(customer)).toHaveLength(1));
  });

  it("is not allowed to a client's person -> 403", async () => {
    const taskId = await create({ participantIds: [idOf(manager)] });
    await request(app).patch(`/api/tasks/${taskId}`).set(admin.auth).send({ visibleToClient: true });

    const res = await comment(customer, taskId, { body: "@Manager", mentionIds: [idOf(manager)] });

    expect(res.status).toBe(403);
  });
});
