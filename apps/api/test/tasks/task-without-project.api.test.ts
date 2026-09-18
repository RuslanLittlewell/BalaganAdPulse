import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedCampaign, seedProject } from "../helpers/db.js";
import { grantAccess, signInAs } from "../helpers/auth.js";

const app = createApp();

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

const create = (body: Record<string, unknown> = {}, auth = admin) =>
  request(app).post("/api/tasks").set(auth).send({ title: "Заметка", priority: "MEDIUM", ...body });

const patch = (id: string, body: Record<string, unknown>, auth = admin) =>
  request(app).patch(`/api/tasks/${id}`).set(auth).send(body);

describe("a task with no project", () => {
  it("is created when no project is named", async () => {
    const res = await create();

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ projectId: null, campaignId: null, column: "IDEA" });
  });

  it("reads back with no project", async () => {
    const created = await create();
    const read = await request(app).get(`/api/tasks/${created.body.id}`).set(admin);
    expect(read.body.projectId).toBeNull();
  });

  it("appears on the board beside the tasks that have one", async () => {
    await create({ projectId });
    await create({ title: "Заметка" });

    const board = await request(app).get("/api/tasks").set(admin);
    expect(board.body.map((task: { projectId: string | null }) => task.projectId).sort())
      .toEqual([null, projectId].sort());
  });

  it("is what a task becomes when its project is cleared", async () => {
    const created = await create({ projectId, column: "IN_PROGRESS" });
    const res = await patch(created.body.id, { projectId: null });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ projectId: null, column: "IN_PROGRESS", position: 0 });
  });

  it("keeps its place in its column when the project is cleared", async () => {
    const first = await create({ projectId, column: "IN_REVIEW" });
    const second = await create({ projectId, column: "IN_REVIEW" });

    await patch(first.body.id, { projectId: null });
    const neighbour = await request(app).get(`/api/tasks/${second.body.id}`).set(admin);
    expect(neighbour.body.position).toBe(1);
  });

  it("takes a project when one is named later", async () => {
    const created = await create();
    const res = await patch(created.body.id, { projectId });
    expect(res.body.projectId).toBe(projectId);
  });

  it("is audited with no client", async () => {
    const created = await create();
    const event = await prisma.auditEvent.findFirstOrThrow({
      where: { entityId: created.body.id },
    });
    expect(event.clientId).toBeNull();
    expect(event.projectId).toBeNull();
  });

  it("still refuses an unreachable project", async () => {
    const stranger = await signInAs("Stranger", { role: "MANAGER" });
    expect((await create({ projectId }, stranger.auth)).status).toBe(404);
  });
});

describe("what a task with no project may not carry", () => {
  it("refuses a campaign -> 400", async () => {
    const campaign = await seedCampaign(projectId, "Поиск", "YANDEX");
    const res = await create({ campaignId: campaign.id });

    expect(res.status).toBe(400);
    expect(await prisma.task.count()).toBe(0);
  });

  it("loses its campaign when its project is cleared", async () => {
    const campaign = await seedCampaign(projectId, "Поиск", "YANDEX");
    const created = await create({ projectId, campaignId: campaign.id });

    const res = await patch(created.body.id, { projectId: null });
    expect(res.body).toMatchObject({ projectId: null, campaignId: null });
  });

  it("refuses being shared with the client -> 400", async () => {
    const created = await create();
    const res = await patch(created.body.id, { visibleToClient: true });

    expect(res.status).toBe(400);
    expect((await request(app).get(`/api/tasks/${created.body.id}`).set(admin)).body.visibleToClient)
      .toBe(false);
  });

  it("refuses being created as shared with the client -> 400", async () => {
    const customer = await signInAs("Customer", { role: "CLIENT" });
    await grantAccess(customer.membership!.id, clientId);

    const res = await create({}, customer.auth);
    expect(res.status).toBe(400);
  });
});

describe("who reaches a task with no project", () => {
  it("is reached by the member who wrote it", async () => {
    const manager = await signInAs("Manager", { role: "MANAGER" });
    const created = await create({}, manager.auth);

    const board = await request(app).get("/api/tasks").set(manager.auth);
    expect(board.body.map((task: { id: string }) => task.id)).toEqual([created.body.id]);
  });

  it("is reached by the member it was given to", async () => {
    const manager = await signInAs("Manager", { role: "MANAGER" });
    const created = await create({ assigneeId: manager.membership!.id });

    expect((await request(app).get(`/api/tasks/${created.body.id}`).set(manager.auth)).status)
      .toBe(200);
  });

  it("answers 404 to a colleague who neither wrote it nor holds it", async () => {
    const author = await signInAs("Author", { role: "MANAGER" });
    const created = await create({}, author.auth);
    const colleague = await signInAs("Colleague", { role: "MANAGER" });

    expect((await request(app).get(`/api/tasks/${created.body.id}`).set(colleague.auth)).status)
      .toBe(404);
    expect((await request(app).get("/api/tasks").set(colleague.auth)).body).toEqual([]);
  });

  it("is reached by every admin of the organization", async () => {
    const manager = await signInAs("Manager", { role: "MANAGER" });
    const created = await create({}, manager.auth);

    expect((await request(app).get(`/api/tasks/${created.body.id}`).set(admin)).status).toBe(200);
  });

  it("is never shown to a client", async () => {
    const customer = await signInAs("Customer", { role: "CLIENT" });
    await grantAccess(customer.membership!.id, clientId);
    await create();

    expect((await request(app).get("/api/tasks").set(customer.auth)).body).toEqual([]);
  });
});
