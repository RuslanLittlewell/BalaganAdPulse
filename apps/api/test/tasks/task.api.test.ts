import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedCampaign, seedProject } from "../helpers/db.js";
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
    const manager = await signInAs("Manager", { role: "MANAGER" });
    await create({ title: "Ungranted", assigneeId: manager.membership!.id });

    expect((await request(app).get("/api/tasks").set(manager.auth)).body).toEqual([]);
    await grantAccess(manager.membership!.id, clientId);
    expect((await request(app).get("/api/tasks").set(manager.auth)).body).toHaveLength(1);
  });

  it("shows a manager nothing of a colleague's, however wide the grant", async () => {
    const colleague = await signInAs("Colleague", { role: "MANAGER" });
    const manager = await signInAs("Manager", { role: "MANAGER" });
    await grantAccess(manager.membership!.id, clientId);
    await create({ title: "Theirs", assigneeId: colleague.membership!.id });
    await create({ title: "Nobody's" });

    expect((await request(app).get("/api/tasks").set(manager.auth)).body).toEqual([]);
  });

  it("lets a guest read the board", async () => {
    const guest = await signInAs("Guest", { role: "GUEST" });
    await grantAccess(guest.membership!.id, clientId);
    await create({ title: "Visible", assigneeId: guest.membership!.id });
    expect((await request(app).get("/api/tasks").set(guest.auth)).status).toBe(200);
  });

  it("shows a client only what is marked as shown to them", async () => {
    const customer = await signInAs("Customer", { role: "CLIENT" });
    await grantAccess(customer.membership!.id, clientId);
    await create({ title: "Внутренняя" });

    const before = await request(app).get("/api/tasks").set(customer.auth);
    expect(before.status).toBe(200);
    expect(before.body).toEqual([]);

    const raised = await request(app).post("/api/tasks").set(customer.auth)
      .send({ projectId, title: "Поменяйте баннер", priority: "MEDIUM" });
    expect(raised.status).toBe(201);

    const after = await request(app).get("/api/tasks").set(customer.auth);
    expect(after.body.map((task: { title: string }) => task.title)).toEqual(["Поменяйте баннер"]);
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
    const guest = await signInAs("Guest", { role: "GUEST" });
    await grantAccess(guest.membership!.id, clientId);
    const created = await create({ assigneeId: guest.membership!.id });
    expect((await request(app).patch(`/api/tasks/${created.body.id}`).set(guest.auth).send({ title: "No" })).status).toBe(403);
  });

  it("refuses a manager who tries to share a task with the client -> 403", async () => {
    const manager = await signInAs("Manager", { role: "MANAGER" });
    await grantAccess(manager.membership!.id, clientId);
    const created = await create({ assigneeId: manager.membership!.id });

    const refused = await request(app).patch(`/api/tasks/${created.body.id}`)
      .set(manager.auth).send({ visibleToClient: true });

    expect(refused.status).toBe(403);
    expect((await prisma.task.findUniqueOrThrow({ where: { id: created.body.id } })).visibleToClient)
      .toBe(false);
  });

  it("lets an admin share a task and take it back", async () => {
    const created = await create({});

    const shared = await request(app).patch(`/api/tasks/${created.body.id}`)
      .set(admin).send({ visibleToClient: true });
    expect(shared.status).toBe(200);
    expect(shared.body.visibleToClient).toBe(true);

    const taken = await request(app).patch(`/api/tasks/${created.body.id}`)
      .set(admin).send({ visibleToClient: false });
    expect(taken.body.visibleToClient).toBe(false);
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
    const guest = await signInAs("Guest", { role: "GUEST" });
    await grantAccess(guest.membership!.id, clientId);
    const created = await create({ assigneeId: guest.membership!.id });

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
    const manager = await signInAs("Manager", { role: "MANAGER" });
    await grantAccess(manager.membership!.id, clientId);
    const created = await create({ assigneeId: manager.membership!.id });
    expect((await request(app).delete(`/api/tasks/${created.body.id}`).set(manager.auth)).status).toBe(204);
  });

  it("is refused to a guest -> 403", async () => {
    const guest = await signInAs("Guest", { role: "GUEST" });
    await grantAccess(guest.membership!.id, clientId);
    const created = await create({ assigneeId: guest.membership!.id });
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

describe("the campaign a task is about", () => {
  it("creates a task on a campaign of its project and reads it back", async () => {
    const campaign = await seedCampaign(projectId, "Поиск / Москва");

    const created = await request(app).post("/api/tasks").set(admin).send({
      projectId, title: "Переписать объявления", priority: "HIGH", campaignId: campaign.id,
    });

    expect(created.status).toBe(201);
    expect(created.body.campaignId).toBe(campaign.id);
    const read = await request(app).get(`/api/tasks/${created.body.id}`).set(admin);
    expect(read.body.campaignId).toBe(campaign.id);
  });

  it("creates a task about the project as a whole when none is named", async () => {
    const created = await request(app).post("/api/tasks").set(admin)
      .send({ projectId, title: "Согласовать бюджет", priority: "LOW" });

    expect(created.status).toBe(201);
    expect(created.body.campaignId).toBeNull();
  });

  it("400s a campaign belonging to another project", async () => {
    const other = await seedProject("unused", "Другой");
    const theirs = await seedCampaign(other.projectId, "Их кампания");

    const created = await request(app).post("/api/tasks").set(admin)
      .send({ projectId, title: "T", priority: "LOW", campaignId: theirs.id });

    expect(created.status).toBe(400);
    expect(await prisma.task.count()).toBe(0);
  });

  it("400s a campaign that does not exist, the same way", async () => {
    const created = await request(app).post("/api/tasks").set(admin).send({
      projectId, title: "T", priority: "LOW",
      campaignId: "00000000-0000-0000-0000-000000000000",
    });

    expect(created.status).toBe(400);
  });

  it("400s a campaign id that is not a uuid", async () => {
    const created = await request(app).post("/api/tasks").set(admin)
      .send({ projectId, title: "T", priority: "LOW", campaignId: "not-a-uuid" });

    expect(created.status).toBe(400);
  });

  it("attaches and releases a campaign through an update", async () => {
    const campaign = await seedCampaign(projectId, "Лента");
    const created = await request(app).post("/api/tasks").set(admin)
      .send({ projectId, title: "T", priority: "LOW" });

    const attached = await request(app).patch(`/api/tasks/${created.body.id}`).set(admin)
      .send({ campaignId: campaign.id });
    expect(attached.status).toBe(200);
    expect(attached.body.campaignId).toBe(campaign.id);

    const released = await request(app).patch(`/api/tasks/${created.body.id}`).set(admin)
      .send({ campaignId: null });
    expect(released.body.campaignId).toBeNull();
  });

  it("releases the campaign when the task moves to another project", async () => {
    const campaign = await seedCampaign(projectId, "Лента");
    const other = await seedProject("unused", "Другой");
    const created = await request(app).post("/api/tasks").set(admin)
      .send({ projectId, title: "T", priority: "LOW", campaignId: campaign.id });

    const moved = await request(app).patch(`/api/tasks/${created.body.id}`).set(admin)
      .send({ projectId: other.projectId });

    expect(moved.status).toBe(200);
    expect(moved.body).toMatchObject({ projectId: other.projectId, campaignId: null });
  });
});

describe("GET /api/projects/:projectId/campaigns/names", () => {
  it("lists a project's campaigns without figures or a range", async () => {
    const first = await seedCampaign(projectId, "Поиск / Москва", "YANDEX");
    const second = await seedCampaign(projectId, "Лента", "META");

    const res = await request(app).get(`/api/projects/${projectId}/campaigns/names`).set(admin);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { id: first.id, name: "Поиск / Москва", channel: "YANDEX" },
      { id: second.id, name: "Лента", channel: "META" },
    ]);
  });

  it("answers an empty list for a project with no campaigns", async () => {
    const res = await request(app).get(`/api/projects/${projectId}/campaigns/names`).set(admin);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("404s a project the caller cannot reach", async () => {
    const outsider = await signInAsOutsider();
    const theirProject = await prisma.project.create({
      data: { clientId: outsider.client.id, name: "Их проект", position: 0 },
    });

    const res = await request(app).get(`/api/projects/${theirProject.id}/campaigns/names`).set(admin);

    expect(res.status).toBe(404);
  });

  it("requires authentication", async () => {
    expect((await request(app).get(`/api/projects/${projectId}/campaigns/names`)).status).toBe(401);
  });
});

describe("GET /api/tasks?campaignId=", () => {
  it("returns only the tasks naming that campaign", async () => {
    const first = await seedCampaign(projectId, "Поиск");
    const second = await seedCampaign(projectId, "Лента", "META");
    await create({ title: "На поиске", campaignId: first.id });
    await create({ title: "На ленте", campaignId: second.id });
    await create({ title: "Общая" });

    const res = await request(app).get(`/api/tasks?campaignId=${first.id}`).set(admin);

    expect(res.status).toBe(200);
    expect(res.body.map((task: { title: string }) => task.title)).toEqual(["На поиске"]);
  });

  it("narrows by project and campaign together", async () => {
    const campaign = await seedCampaign(projectId, "Поиск");
    await create({ title: "На поиске", campaignId: campaign.id });

    const res = await request(app)
      .get(`/api/tasks?projectId=${projectId}&campaignId=${campaign.id}`).set(admin);

    expect(res.body.map((task: { title: string }) => task.title)).toEqual(["На поиске"]);
  });

  it("returns nothing for a campaign under a project the caller cannot reach", async () => {
    const manager = await signInAs("Manager", { role: "MANAGER" });
    const campaign = await seedCampaign(projectId, "Поиск");
    await create({ title: "На поиске", campaignId: campaign.id });

    const res = await request(app).get(`/api/tasks?campaignId=${campaign.id}`).set(manager.auth);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("answers an empty list for a campaign that does not exist, the same way", async () => {
    await create({ title: "Общая" });

    const res = await request(app).get(`/api/tasks?campaignId=${MISSING}`).set(admin);

    expect(res.body).toEqual([]);
  });

  it("returns every reachable task when no campaign is named", async () => {
    const campaign = await seedCampaign(projectId, "Поиск");
    await create({ title: "На поиске", campaignId: campaign.id });
    await create({ title: "Общая" });

    const res = await request(app).get("/api/tasks").set(admin);

    expect(res.body).toHaveLength(2);
  });
});

describe("what a client's principal sees on the board", () => {
  it("sees what is marked as shown to the client, and nothing else", async () => {
    const principal = await signInAs("Главный", { role: "CLIENT_ADMIN" });
    await grantAccess(principal.membership!.id, clientId);
    await create({ title: "Внутренняя" });
    const shown = await create({ title: "Открытая" });
    await request(app).patch(`/api/tasks/${shown.body.id}`).set(admin)
      .send({ visibleToClient: true });

    const board = await request(app).get("/api/tasks").set(principal.auth);

    expect(board.status).toBe(200);
    expect(board.body.map((task: { title: string }) => task.title)).toEqual(["Открытая"]);
  });

  it("marks a task it raises as shown to the client", async () => {
    const principal = await signInAs("Главный", { role: "CLIENT_ADMIN" });
    await grantAccess(principal.membership!.id, clientId);

    const raised = await request(app).post("/api/tasks").set(principal.auth)
      .send({ projectId, title: "Поменяйте баннер", priority: "HIGH" });

    expect(raised.status).toBe(201);
    expect(raised.body.visibleToClient).toBe(true);
  });

  it("is refused an edit, like any customer", async () => {
    const principal = await signInAs("Главный", { role: "CLIENT_ADMIN" });
    await grantAccess(principal.membership!.id, clientId);
    const raised = await request(app).post("/api/tasks").set(principal.auth)
      .send({ projectId, title: "Заявка", priority: "LOW" });

    const refused = await request(app).patch(`/api/tasks/${raised.body.id}`)
      .set(principal.auth).send({ title: "Другое" });

    expect(refused.status).toBe(403);
  });

  it("sees the same board an ordinary customer sees", async () => {
    const principal = await signInAs("Главный", { role: "CLIENT_ADMIN" });
    await grantAccess(principal.membership!.id, clientId);
    const colleague = await signInAs("Коллега", { role: "CLIENT" });
    await grantAccess(colleague.membership!.id, clientId);
    const raised = await request(app).post("/api/tasks").set(principal.auth)
      .send({ projectId, title: "Заявка главного", priority: "LOW" });
    expect(raised.status).toBe(201);

    const theirs = await request(app).get("/api/tasks").set(colleague.auth);

    expect(theirs.body.map((task: { title: string }) => task.title))
      .toEqual(["Заявка главного"]);
  });
});
