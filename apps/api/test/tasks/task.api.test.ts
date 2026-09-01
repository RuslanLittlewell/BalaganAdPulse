import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { currentOrg, grantAccess, signInAs, signInAsOutsider } from "../helpers/auth.js";

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

const create = (body: Record<string, unknown>, auth = admin) =>
  request(app).post("/api/tasks").set(auth).send({ projectId, title: "T", priority: "MEDIUM", ...body });

describe("POST /api/tasks", () => {
  it("creates a task in IDEA (201)", async () => {
    const res = await create({ title: "Write the brief" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      title: "Write the brief", column: "IDEA", priority: "MEDIUM",
      projectId, position: 0, assigneeId: null,
    });
  });

  it("appends each new task to the end of its column", async () => {
    await create({ title: "First" });
    const second = await create({ title: "Second" });
    expect(second.body.position).toBe(1);
  });

  it("accepts an explicit column", async () => {
    const res = await create({ column: "IN_REVIEW" });
    expect(res.body.column).toBe("IN_REVIEW");
  });

  it("refuses a blank title -> 400", async () => {
    expect((await create({ title: "   " })).status).toBe(400);
  });

  it("refuses a missing project -> 400", async () => {
    const res = await request(app).post("/api/tasks").set(admin).send({ title: "T", priority: "LOW" });
    expect(res.status).toBe(400);
  });

  it("refuses an unknown column -> 400", async () => {
    expect((await create({ column: "BACKLOG" })).status).toBe(400);
  });

  it("refuses an unknown priority -> 400", async () => {
    expect((await create({ priority: "WHENEVER" })).status).toBe(400);
  });

  it("answers 404 for a project out of reach", async () => {
    const stranger = await signInAs("Stranger", { role: "MANAGER" });
    expect((await create({}, stranger.auth)).status).toBe(404);
  });

  it("stores a structured description", async () => {
    const description = { type: "doc", content: [{ type: "paragraph" }] };
    const res = await create({ description });
    expect(res.body.description).toEqual(description);
  });

  it("accepts an active member of the organization as responsible", async () => {
    const member = await signInAs("Member", { role: "MANAGER" });
    const res = await create({ assigneeId: member.membership!.id });
    expect(res.body.assigneeId).toBe(member.membership!.id);
  });

  it("refuses a suspended member as responsible -> 400", async () => {
    const dormant = await signInAs("Dormant", { role: "MANAGER", status: "SUSPENDED" });
    expect((await create({ assigneeId: dormant.membership!.id })).status).toBe(400);
  });

  it("refuses a member of another organization as responsible -> 400", async () => {
    const outsider = await signInAsOutsider();
    expect((await create({ assigneeId: outsider.membership.id })).status).toBe(400);
  });
});

describe("GET /api/tasks", () => {
  it("returns the board ordered by column then position", async () => {
    const idea = await create({ title: "Idea" });
    const done = await create({ title: "Done", column: "DONE" });
    const archived = await create({ title: "Archived", column: "ARCHIVED" });

    const res = await request(app).get("/api/tasks").set(admin);
    expect(res.status).toBe(200);
    expect(res.body.map((t: { id: string }) => t.id))
      .toEqual([idea.body.id, archived.body.id, done.body.id]);
  });

  it("narrows to one project on request", async () => {
    await create({ title: "Here" });
    const other = await seedProject((await signInAs("Other", { role: "ADMIN" })).user.id, "Globex");
    await create({ projectId: other.projectId, title: "There" });

    const res = await request(app).get(`/api/tasks?projectId=${other.projectId}`).set(admin);
    expect(res.body.map((t: { title: string }) => t.title)).toEqual(["There"]);
  });

  it("shows a manager only the tasks their grants reach", async () => {
    await create({ title: "Ungranted" });
    const manager = await signInAs("Manager", { role: "MANAGER" });

    expect((await request(app).get("/api/tasks").set(manager.auth)).body).toEqual([]);
    await grantAccess(manager.membership!.id, clientId);
    expect((await request(app).get("/api/tasks").set(manager.auth)).body).toHaveLength(1);
  });

  it("lets a guest read the board", async () => {
    await create({ title: "Visible" });
    const guest = await signInAs("Guest", { role: "GUEST" });
    await grantAccess(guest.membership!.id, clientId);
    expect((await request(app).get("/api/tasks").set(guest.auth)).status).toBe(200);
  });

  it("refuses a client-role member the board -> 403", async () => {
    const customer = await signInAs("Customer", { role: "CLIENT" });
    await grantAccess(customer.membership!.id, clientId);
    expect((await request(app).get("/api/tasks").set(customer.auth)).status).toBe(403);
  });
});

describe("GET /api/tasks/:id", () => {
  it("returns a reachable task", async () => {
    const created = await create({});
    expect((await request(app).get(`/api/tasks/${created.body.id}`).set(admin)).status).toBe(200);
  });

  it("answers 404 for an unreachable task, the same as for a missing one", async () => {
    const created = await create({});
    const stranger = await signInAs("Stranger", { role: "MANAGER" });

    const unreachable = await request(app).get(`/api/tasks/${created.body.id}`).set(stranger.auth);
    const missing = await request(app).get(`/api/tasks/${MISSING}`).set(stranger.auth);
    expect(unreachable.status).toBe(404);
    expect(unreachable.body.error.message).toBe(missing.body.error.message);
  });
});

describe("PATCH /api/tasks/:id", () => {
  it("changes the title without moving the card", async () => {
    const created = await create({ column: "IN_REVIEW" });
    const res = await request(app).patch(`/api/tasks/${created.body.id}`)
      .set(admin).send({ title: "Renamed" });
    expect(res.body).toMatchObject({ title: "Renamed", column: "IN_REVIEW", position: 0 });
  });

  it("clears the responsible member", async () => {
    const member = await signInAs("Member", { role: "MANAGER" });
    const created = await create({ assigneeId: member.membership!.id });
    const res = await request(app).patch(`/api/tasks/${created.body.id}`)
      .set(admin).send({ assigneeId: null });
    expect(res.body.assigneeId).toBeNull();
  });

  it("refuses a guest -> 403", async () => {
    const created = await create({});
    const guest = await signInAs("Guest", { role: "GUEST" });
    await grantAccess(guest.membership!.id, clientId);
    expect((await request(app).patch(`/api/tasks/${created.body.id}`).set(guest.auth).send({ title: "No" })).status).toBe(403);
  });
});

describe("POST /api/tasks/:id/move", () => {
  it("moves a card into another column and renumbers both", async () => {
    const a = await create({ title: "A" });
    const b = await create({ title: "B" });
    const x = await create({ title: "X", column: "DONE" });

    const res = await request(app).post(`/api/tasks/${a.body.id}/move`)
      .set(admin).send({ column: "DONE", position: 0 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ column: "DONE", position: 0 });

    const board = await request(app).get("/api/tasks").set(admin);
    const byId = new Map(board.body.map((t: { id: string }) => [t.id, t]));
    expect(byId.get(b.body.id)).toMatchObject({ column: "IDEA", position: 0 });
    expect(byId.get(x.body.id)).toMatchObject({ column: "DONE", position: 1 });
  });

  it("reorders within one column", async () => {
    const a = await create({ title: "A" });
    const b = await create({ title: "B" });
    await request(app).post(`/api/tasks/${b.body.id}/move`).set(admin).send({ column: "IDEA", position: 0 });

    const board = await request(app).get("/api/tasks").set(admin);
    expect(board.body.map((t: { id: string }) => t.id)).toEqual([b.body.id, a.body.id]);
  });

  it("clamps a position past the end of the column", async () => {
    const a = await create({ title: "A" });
    await create({ title: "B", column: "DONE" });
    const res = await request(app).post(`/api/tasks/${a.body.id}/move`)
      .set(admin).send({ column: "DONE", position: 99 });
    expect(res.body.position).toBe(1);
  });

  it("refuses an unknown column and moves nothing -> 400", async () => {
    const created = await create({});
    expect((await request(app).post(`/api/tasks/${created.body.id}/move`)
      .set(admin).send({ column: "BACKLOG", position: 0 })).status).toBe(400);
    const after = await prisma.task.findUniqueOrThrow({ where: { id: created.body.id } });
    expect(after.column).toBe("IDEA");
  });

  it("refuses a guest and leaves the card where it was -> 403", async () => {
    const created = await create({});
    const guest = await signInAs("Guest", { role: "GUEST" });
    await grantAccess(guest.membership!.id, clientId);

    expect((await request(app).post(`/api/tasks/${created.body.id}/move`)
      .set(guest.auth).send({ column: "DONE", position: 0 })).status).toBe(403);
    const after = await prisma.task.findUniqueOrThrow({ where: { id: created.body.id } });
    expect(after.column).toBe("IDEA");
  });
});

describe("DELETE /api/tasks/:id", () => {
  it("removes the task and closes the gap (204)", async () => {
    const a = await create({ title: "A" });
    const b = await create({ title: "B" });
    const c = await create({ title: "C" });

    expect((await request(app).delete(`/api/tasks/${b.body.id}`).set(admin)).status).toBe(204);
    const board = await request(app).get("/api/tasks").set(admin);
    expect(board.body.map((t: { id: string }) => t.id)).toEqual([a.body.id, c.body.id]);
    expect(board.body.map((t: { position: number }) => t.position)).toEqual([0, 1]);
  });

  it("is permitted to a manager", async () => {
    const created = await create({});
    const manager = await signInAs("Manager", { role: "MANAGER" });
    await grantAccess(manager.membership!.id, clientId);
    expect((await request(app).delete(`/api/tasks/${created.body.id}`).set(manager.auth)).status).toBe(204);
  });

  it("is refused to a guest -> 403", async () => {
    const created = await create({});
    const guest = await signInAs("Guest", { role: "GUEST" });
    await grantAccess(guest.membership!.id, clientId);
    expect((await request(app).delete(`/api/tasks/${created.body.id}`).set(guest.auth)).status).toBe(403);
    expect(await prisma.task.count()).toBe(1);
  });
});

describe("the audit trail", () => {
  it("records a create, a move naming both columns, and a delete", async () => {
    const created = await create({ title: "Brief" });
    await request(app).post(`/api/tasks/${created.body.id}/move`)
      .set(admin).send({ column: "DONE", position: 0 });
    await request(app).delete(`/api/tasks/${created.body.id}`).set(admin);

    const events = await prisma.auditEvent.findMany({
      where: { entityType: "task" }, orderBy: { createdAt: "asc" },
    });
    expect(events.map((e) => e.action)).toEqual(["CREATE", "UPDATE", "DELETE"]);
    expect(events[1]!.summary).toBe("Moved task “Brief” from IDEA to DONE");
    expect(events.every((e) => e.clientId === clientId && e.projectId === projectId)).toBe(true);
  });

  it("writes no event for a refused mutation", async () => {
    const created = await create({});
    const guest = await signInAs("Guest", { role: "GUEST" });
    await grantAccess(guest.membership!.id, clientId);
    const before = await prisma.auditEvent.count();

    await request(app).delete(`/api/tasks/${created.body.id}`).set(guest.auth);
    expect(await prisma.auditEvent.count()).toBe(before);
  });
});

describe("attachments on a task", () => {
  const PNG = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );

  async function uploadImage() {
    const res = await request(app).post("/api/task-images").set(admin)
      .attach("image", PNG, { filename: "shot.png", contentType: "image/png" });
    return res.body.id as string;
  }

  it("reports no attachments for a plain task", async () => {
    const created = await create({});
    expect(created.body.imageIds).toEqual([]);
  });

  it("names the images a description claims, so the board can show a paperclip", async () => {
    const imageId = await uploadImage();
    const created = await create({
      description: { type: "doc", content: [{ type: "taskImage", attrs: { imageId } }] },
    });
    expect(created.body.imageIds).toEqual([imageId]);

    const board = await request(app).get("/api/tasks").set(admin);
    expect(board.body[0].imageIds).toEqual([imageId]);
  });

  it("picks up an image added by a later edit", async () => {
    const created = await create({});
    const imageId = await uploadImage();
    const updated = await request(app).patch(`/api/tasks/${created.body.id}`).set(admin).send({
      description: { type: "doc", content: [{ type: "taskImage", attrs: { imageId } }] },
    });
    expect(updated.body.imageIds).toEqual([imageId]);
  });

  it("reads them back when the task is opened again", async () => {
    const imageId = await uploadImage();
    const created = await create({
      description: { type: "doc", content: [{ type: "taskImage", attrs: { imageId } }] },
    });
    const reopened = await request(app).get(`/api/tasks/${created.body.id}`).set(admin);
    expect(reopened.body.imageIds).toEqual([imageId]);
  });
});

