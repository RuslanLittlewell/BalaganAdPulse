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

describe("editing a comment", () => {
  const editOf = (by: SignedIn, taskId: string, commentId: string, body: Record<string, unknown>) =>
    request(app).patch(`/api/tasks/${taskId}/comments/${commentId}`).set(by.auth).send(body);

  it("is the author's to do, keeping its place and marking it edited", async () => {
    const taskId = await create();
    const first = await comment(manager, taskId, { body: "Опечатак" });
    await comment(colleague, taskId, { body: "Ответ" });
    expect(first.body.editedAt).toBeNull();

    const res = await editOf(manager, taskId, first.body.id, { body: "  Опечатка  " });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: first.body.id, body: "Опечатка", createdAt: first.body.createdAt });
    expect(res.body.editedAt).toEqual(expect.any(String));
    expect((await list(admin, taskId)).body.map((c: { body: string }) => c.body)).toEqual(["Опечатка", "Ответ"]);
  });

  it.each([["an admin", () => admin], ["another member", () => colleague]])("is refused to %s -> 403", async (_who, by) => {
    const taskId = await create();
    const written = await comment(manager, taskId, { body: "Моё" });

    const res = await editOf(by(), taskId, written.body.id, { body: "Чужое" });

    expect(res.status).toBe(403);
    expect((await list(manager, taskId)).body[0]).toMatchObject({ body: "Моё", editedAt: null });
  });

  it("refuses an empty text -> 400", async () => {
    const taskId = await create();
    const written = await comment(manager, taskId, { body: "Моё" });

    expect((await editOf(manager, taskId, written.body.id, { body: "   " })).status).toBe(400);
  });

  it("reports a missing comment -> 404", async () => {
    const taskId = await create();
    expect((await editOf(manager, taskId, MISSING, { body: "Текст" })).status).toBe(404);
  });

  it("notifies only the members it newly tags", async () => {
    const taskId = await create();
    const written = await comment(manager, taskId, { body: "@Colleague глянь", mentionIds: [idOf(colleague)] });
    await vi.waitFor(async () => expect(await mentionsOf(colleague)).toHaveLength(1));

    const res = await editOf(manager, taskId, written.body.id, {
      body: "@Colleague @Admin глянь", mentionIds: [idOf(colleague), idOf(admin)],
    });

    expect(res.body.mentionIds).toEqual([idOf(colleague), idOf(admin)]);
    await vi.waitFor(async () => expect(await mentionsOf(admin)).toHaveLength(1));
    expect(await mentionsOf(colleague)).toHaveLength(1);
  });

  it("refuses to tag a stranger -> 400", async () => {
    const taskId = await create();
    const written = await comment(manager, taskId, { body: "Моё" });

    expect((await editOf(manager, taskId, written.body.id, { body: "@X", mentionIds: [MISSING] })).status).toBe(400);
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

  it("lets a client's person tag the people named on the task", async () => {
    const taskId = await create();
    await request(app).patch(`/api/tasks/${taskId}`).set(admin.auth).send({ visibleToClient: true });

    const res = await comment(customer, taskId, { body: "@Manager посмотрите", mentionIds: [idOf(manager)] });

    expect(res.status).toBe(201);
    expect(res.body.mentionIds).toEqual([idOf(manager)]);
    await vi.waitFor(async () => expect(await mentionsOf(manager)).toHaveLength(1));
  });

  it("refuses a client's person tagging somebody not named on the task -> 400", async () => {
    const taskId = await create();
    await request(app).patch(`/api/tasks/${taskId}`).set(admin.auth).send({ visibleToClient: true });

    const res = await comment(customer, taskId, { body: "@Admin", mentionIds: [idOf(admin)] });

    expect(res.status).toBe(400);
    expect((await list(admin, taskId)).body).toEqual([]);
  });
});

describe("a client's comments", () => {
  const shared = async () => {
    const taskId = await create();
    await request(app).patch(`/api/tasks/${taskId}`).set(admin.auth).send({ visibleToClient: true });
    return taskId;
  };

  it("are written on a shared task the client may not change, and carry the client's name", async () => {
    const taskId = await shared();

    const res = await comment(customer, taskId, { body: "Когда будет готово?" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ authorId: idOf(customer), authorName: "Customer" });
    expect((await request(app).patch(`/api/tasks/${taskId}`).set(customer.auth).send({ title: "Иначе" })).status).toBe(403);
  });

  it("show the client who wrote the agency's comments", async () => {
    const taskId = await shared();
    await comment(manager, taskId, { body: "Сегодня" });

    const res = await list(customer, taskId);

    expect(res.body.map((written: { authorName: string; body: string }) => [written.authorName, written.body]))
      .toEqual([["Manager", "Сегодня"]]);
  });

  it("are edited and deleted by the client who wrote them", async () => {
    const taskId = await shared();
    const written = (await comment(customer, taskId, { body: "Черновик" })).body;

    const edited = await request(app).patch(`/api/tasks/${taskId}/comments/${written.id}`).set(customer.auth).send({ body: "Итог" });
    expect(edited.status).toBe(200);
    expect(edited.body).toMatchObject({ body: "Итог", authorName: "Customer" });
    expect((await request(app).delete(`/api/tasks/${taskId}/comments/${written.id}`).set(customer.auth)).status).toBe(204);
  });

  it("keep markup as the characters typed", async () => {
    const taskId = await shared();
    const markup = "<img src=x onerror=alert(1)><script>alert(2)</script>";

    await comment(customer, taskId, { body: markup });

    expect((await list(admin, taskId)).body[0].body).toBe(markup);
  });

  it("are refused on the agency's own task", async () => {
    const taskId = await create();

    expect((await comment(customer, taskId, { body: "?" })).status).toBe(404);
  });
});

describe("the people named on a task", () => {
  const participants = (by: SignedIn, taskId: string) =>
    request(app).get(`/api/tasks/${taskId}/participants`).set(by.auth);

  it("are named to a client who reaches the shared task, the suspended left out", async () => {
    const taskId = await create();
    await request(app).patch(`/api/tasks/${taskId}`).set(admin.auth).send({ visibleToClient: true });
    await request(app).patch(`/api/members/${idOf(colleague)}`).set(admin.auth).send({ status: "SUSPENDED" });

    const res = await participants(customer, taskId);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: idOf(manager), name: "Manager", image: null }]);
  });

  it("are not named to somebody who does not reach the task -> 404", async () => {
    const taskId = await create();

    expect((await participants(customer, taskId)).status).toBe(404);
  });
});
