import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { PrismaUnitOfWork } from "../../src/shared/infrastructure/prisma-unit-of-work.js";
import { RandomIdGenerator } from "../../src/shared/infrastructure/id-generator.js";
import { createLeadUseCases } from "../../src/modules/leads/index.js";
import { PrismaLeadRepository } from "../../src/modules/leads/infrastructure/prisma-lead-repository.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { grantAccess, signInAs, type SignedIn } from "../helpers/auth.js";

const app = createApp();

let admin: SignedIn;
let auth: { Authorization: string };
let clientId: string;
let projectId: string;
let otherProjectId: string;

beforeEach(async () => {
  await resetDb();
  admin = await signInAs();
  auth = admin.auth;
  ({ clientId, projectId } = await seedProject(admin.user.id));
  otherProjectId = (await prisma.project.create({ data: { clientId, name: "Второй", position: 1 } })).id;
});

afterAll(() => prisma.$disconnect());

const columns = (board: string = projectId) => `/api/crm/boards/${board}/columns`;
const leads = (board: string = projectId) => `/api/crm/boards/${board}/leads`;

const addColumn = (name: string, board: string = projectId, as = auth) =>
  request(app).post(columns(board)).set(as).send({ name });
const addLead = (name: string, stage?: string, board: string = projectId) =>
  request(app).post(leads(board)).set(auth).send({ name, ...(stage ? { stage } : {}) });
const listColumns = async (board: string = projectId) =>
  (await request(app).get(columns(board)).set(auth).expect(200)).body as Array<{ id: string; kind: string; name: string; position: number }>;
const listLeads = async (board: string = projectId) =>
  (await request(app).get(leads(board)).set(auth).expect(200)).body as Array<{ id: string; name: string; stage: string; position: number }>;

const FIXED = [
  { id: "NEW", kind: "FIXED", name: "Новый", position: 0 },
  { id: "QUALIFIED", kind: "FIXED", name: "Квалифицированный", position: 1 },
  { id: "TARGET", kind: "FIXED", name: "Целевой", position: 2 },
  { id: "PROPOSAL", kind: "FIXED", name: "КП", position: 3 },
];

describe("board columns", () => {
  it("lists the four fixed stages, then the board's own columns in order", async () => {
    expect(await listColumns()).toEqual(FIXED);

    const meeting = await addColumn("  Встреча  ");
    expect(meeting.status).toBe(201);
    expect(meeting.body).toEqual({ id: expect.any(String), kind: "CUSTOM", name: "Встреча", position: 0 });
    await addColumn("Договор").expect(201);

    expect(await listColumns()).toEqual([
      ...FIXED,
      { id: meeting.body.id, kind: "CUSTOM", name: "Встреча", position: 0 },
      { id: expect.any(String), kind: "CUSTOM", name: "Договор", position: 1 },
    ]);
    expect(await listColumns(otherProjectId)).toEqual(FIXED);
  });

  it.each([
    ["a blank name", " "],
    ["a name over 50 characters", "x".repeat(51)],
    ["a fixed stage name", "целевой"],
    ["an existing name in another case", "ВСТРЕЧА"],
  ])("refuses %s", async (_, name) => {
    await addColumn("Встреча").expect(201);

    expect((await addColumn(name)).status).toBe(400);
    expect(await prisma.leadColumn.count()).toBe(1);
  });

  it("allows the same name on another board", async () => {
    await addColumn("Встреча").expect(201);

    expect((await addColumn("Встреча", otherProjectId)).status).toBe(201);
  });

  it("holds at most twenty custom columns on a board", async () => {
    for (let index = 0; index < 20; index++) await addColumn(`Столбец ${index}`).expect(201);

    expect((await addColumn("Лишний")).status).toBe(400);
    expect(await prisma.leadColumn.count()).toBe(20);
  });

  it("renames a column in place, including a change of letter case", async () => {
    const meeting = (await addColumn("Встреча")).body;
    await addColumn("Договор").expect(201);

    await request(app).patch(`${columns()}/${meeting.id}`).set(auth).send({ name: "Встреча назначена" }).expect(200);
    await request(app).patch(`${columns()}/${meeting.id}`).set(auth).send({ name: "ВСТРЕЧА назначена" }).expect(200);
    expect((await request(app).patch(`${columns()}/${meeting.id}`).set(auth).send({ name: "Договор" })).status).toBe(400);

    expect((await listColumns()).slice(4).map((column) => [column.name, column.position])).toEqual([
      ["ВСТРЕЧА назначена", 0],
      ["Договор", 1],
    ]);
  });

  it("moves a column among the custom columns and keeps the fixed stages first", async () => {
    await addColumn("Первый").expect(201);
    const second = (await addColumn("Второй")).body;
    const third = (await addColumn("Третий")).body;

    const moved = await request(app).patch(`${columns()}/${second.id}`).set(auth).send({ position: 4 });
    expect(moved.status).toBe(200);
    expect(moved.body.map((column: { name: string }) => column.name)).toEqual(["Новый", "Квалифицированный", "Целевой", "КП", "Второй", "Первый", "Третий"]);

    await request(app).patch(`${columns()}/${third.id}`).set(auth).send({ position: 4 }).expect(200);
    await request(app).patch(`${columns()}/${third.id}`).set(auth).send({ position: 99 }).expect(200);
    expect((await listColumns()).slice(4).map((column) => [column.name, column.position])).toEqual([
      ["Второй", 0],
      ["Первый", 1],
      ["Третий", 2],
    ]);
    expect((await request(app).patch(`${columns()}/${third.id}`).set(auth).send({ position: -1 })).status).toBe(400);
    expect((await request(app).patch(`${columns()}/${third.id}`).set(auth).send({})).status).toBe(400);
  });

  it("moves a custom column across fixed stages, including to the very start of the board", async () => {
    const meeting = (await addColumn("Встреча")).body;

    const betweenNewAndQualified = await request(app).patch(`${columns()}/${meeting.id}`).set(auth).send({ position: 1 });
    expect(betweenNewAndQualified.status).toBe(200);
    expect(betweenNewAndQualified.body.map((column: { name: string }) => column.name)).toEqual(
      ["Новый", "Встреча", "Квалифицированный", "Целевой", "КП"],
    );

    const betweenTargetAndProposal = await request(app).patch(`${columns()}/${meeting.id}`).set(auth).send({ position: 3 });
    expect(betweenTargetAndProposal.body.map((column: { name: string }) => column.name)).toEqual(
      ["Новый", "Квалифицированный", "Целевой", "Встреча", "КП"],
    );

    const atStart = await request(app).patch(`${columns()}/${meeting.id}`).set(auth).send({ position: 0 });
    expect(atStart.body.map((column: { name: string }) => column.name)).toEqual(
      ["Встреча", "Новый", "Квалифицированный", "Целевой", "КП"],
    );
    expect(await listColumns()).toEqual([
      { id: meeting.id, kind: "CUSTOM", name: "Встреча", position: 0 },
      ...FIXED,
    ]);
  });

  it("refuses renaming, moving or deleting a fixed stage", async () => {
    expect((await request(app).patch(`${columns()}/TARGET`).set(auth).send({ name: "Горячий" })).status).toBe(400);
    expect((await request(app).patch(`${columns()}/TARGET`).set(auth).send({ position: 0 })).status).toBe(400);
    expect((await request(app).delete(`${columns()}/TARGET`).set(auth)).status).toBe(400);
    expect(await listColumns()).toEqual(FIXED);
  });

  it("does not reach a column through another board", async () => {
    const foreign = (await addColumn("Встреча", otherProjectId)).body;

    expect((await request(app).patch(`${columns()}/${foreign.id}`).set(auth).send({ name: "Чужой" })).status).toBe(404);
    expect((await request(app).delete(`${columns()}/${foreign.id}`).set(auth)).status).toBe(404);
    expect(await listColumns(otherProjectId)).toContainEqual(expect.objectContaining({ id: foreign.id, name: "Встреча" }));
  });

  it("deleting a column moves its leads to the end of Новый in their order and closes the gap", async () => {
    const first = (await addColumn("Первый")).body;
    const meeting = (await addColumn("Встреча")).body;
    const last = (await addColumn("Последний")).body;
    await addLead("Новый 1").expect(201);
    for (const name of ["Встреча 1", "Встреча 2", "Встреча 3"]) await addLead(name, meeting.id).expect(201);

    await request(app).delete(`${columns()}/${meeting.id}`).set(auth).expect(204);

    expect((await listLeads()).map((lead) => [lead.name, lead.stage, lead.position])).toEqual([
      ["Новый 1", "NEW", 0],
      ["Встреча 3", "NEW", 1],
      ["Встреча 2", "NEW", 2],
      ["Встреча 1", "NEW", 3],
    ]);
    expect((await listColumns()).slice(4)).toEqual([
      { id: first.id, kind: "CUSTOM", name: "Первый", position: 0 },
      { id: last.id, kind: "CUSTOM", name: "Последний", position: 1 },
    ]);
  });
});

describe("leads in custom columns", () => {
  it("creates a lead first in a custom column and moves it between fixed and custom columns", async () => {
    const meeting = (await addColumn("Встреча")).body;
    await addLead("Первый", meeting.id).expect(201);
    const created = await addLead("Второй", meeting.id);
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ stage: meeting.id, position: 0 });
    const proposal = (await addLead("КП", "PROPOSAL")).body;

    const intoColumn = await request(app).patch(`${leads()}/${proposal.id}/move`).set(auth).send({ stage: meeting.id, position: 0 });
    expect(intoColumn.status).toBe(200);
    expect((await listLeads()).map((lead) => [lead.name, lead.stage, lead.position])).toEqual([
      ["КП", meeting.id, 0],
      ["Второй", meeting.id, 1],
      ["Первый", meeting.id, 2],
    ]);

    await request(app).patch(`${leads()}/${proposal.id}/move`).set(auth).send({ stage: "PROPOSAL", position: 0 }).expect(200);
    expect((await listLeads()).map((lead) => [lead.name, lead.stage, lead.position])).toEqual([
      ["КП", "PROPOSAL", 0],
      ["Второй", meeting.id, 0],
      ["Первый", meeting.id, 1],
    ]);
  });

  it("orders a board by fixed stages, then custom columns, then position", async () => {
    const later = (await addColumn("Позже")).body;
    const sooner = (await addColumn("Раньше")).body;
    await request(app).patch(`${columns()}/${sooner.id}`).set(auth).send({ position: 4 }).expect(200);
    await addLead("В позже", later.id).expect(201);
    await addLead("В раньше", sooner.id).expect(201);
    await addLead("Целевой", "TARGET").expect(201);
    await addLead("Новый").expect(201);

    expect((await listLeads()).map((lead) => lead.name)).toEqual(["Новый", "Целевой", "В раньше", "В позже"]);
  });

  it("refuses a stage that is neither fixed nor a column of the board", async () => {
    const foreign = (await addColumn("Встреча", otherProjectId)).body;
    const lead = (await addLead("Лид")).body;

    expect((await addLead("Чужой", foreign.id)).status).toBe(400);
    expect((await request(app).patch(`${leads()}/${lead.id}/move`).set(auth).send({ stage: foreign.id, position: 0 })).status).toBe(400);
    expect((await request(app).patch(`${leads()}/${lead.id}/move`).set(auth).send({ stage: "WON", position: 0 })).status).toBe(400);
    expect(await listLeads()).toEqual([expect.objectContaining({ id: lead.id, stage: "NEW", position: 0 })]);
  });
});

describe("who manages columns", () => {
  it.each(["CLIENT", "CLIENT_ADMIN"] as const)("lets %s manage the columns of their own board only", async (role) => {
    const foreign = await seedProject("unused", "Чужой");
    const customer = await signInAs("Customer", { role });
    await grantAccess(customer.membership!.id, clientId);

    const created = await addColumn("Встреча", projectId, customer.auth);
    expect(created.status).toBe(201);
    await addColumn("Договор", otherProjectId, customer.auth).expect(201);
    await request(app).patch(`${columns()}/${created.body.id}`).set(customer.auth).send({ name: "Звонок" }).expect(200);
    await request(app).patch(`${columns()}/${created.body.id}`).set(customer.auth).send({ position: 1 }).expect(200);
    await request(app).delete(`${columns()}/${created.body.id}`).set(customer.auth).expect(204);

    expect((await request(app).get(columns(foreign.projectId)).set(customer.auth)).status).toBe(404);
    expect((await addColumn("Агентство", "agency", customer.auth)).status).toBe(404);
  });

  it("lets a guest read columns and change none", async () => {
    const meeting = (await addColumn("Встреча")).body;
    const guest = await signInAs("Guest", { role: "GUEST" });
    await grantAccess(guest.membership!.id, clientId);

    expect((await request(app).get(columns()).set(guest.auth)).status).toBe(200);
    expect((await addColumn("Гость", projectId, guest.auth)).status).toBe(403);
    expect((await request(app).patch(`${columns()}/${meeting.id}`).set(guest.auth).send({ name: "Гость" })).status).toBe(403);
    expect((await request(app).delete(`${columns()}/${meeting.id}`).set(guest.auth)).status).toBe(403);
    expect((await listColumns()).slice(4)).toEqual([expect.objectContaining({ name: "Встреча" })]);
  });
});

describe("column history and notifications", () => {
  it("records every column change with its board", async () => {
    const meeting = (await addColumn("Встреча", otherProjectId)).body;
    await request(app).patch(`${columns(otherProjectId)}/${meeting.id}`).set(auth).send({ name: "Звонок" }).expect(200);
    await request(app).delete(`${columns(otherProjectId)}/${meeting.id}`).set(auth).expect(204);
    expect((await request(app).patch(`${columns(otherProjectId)}/${meeting.id}`).set(auth).send({ name: "Нет" })).status).toBe(404);

    const events = await prisma.auditEvent.findMany({ where: { entityType: "lead-column" }, orderBy: { createdAt: "asc" } });
    expect(events.map((event) => [event.action, event.entityId, event.clientId, event.projectId, event.actorId])).toEqual([
      ["CREATE", meeting.id, clientId, otherProjectId, admin.membership!.id],
      ["UPDATE", meeting.id, clientId, otherProjectId, admin.membership!.id],
      ["DELETE", meeting.id, clientId, otherProjectId, admin.membership!.id],
    ]);
    expect(events[1].changes).toMatchObject({ before: { name: "Встреча" }, after: { name: "Звонок" } });
  });

  it("keeps column history of another project's board from a project-only grant", async () => {
    await addColumn("Свой").expect(201);
    await addColumn("Чужой", otherProjectId).expect(201);
    const manager = await signInAs("Manager", { role: "MANAGER" });
    await grantAccess(manager.membership!.id, clientId, projectId);

    const history = await request(app).get("/api/audit?entityType=lead-column").set(manager.auth);

    expect(history.body.items).toHaveLength(1);
    expect(history.body.items[0].projectId).toBe(projectId);
  });

  it("tells open boards that a column changed", async () => {
    const unitOfWork = new PrismaUnitOfWork(prisma);
    const publish = vi.fn();
    const useCases = createLeadUseCases({
      leads: new PrismaLeadRepository(prisma, unitOfWork),
      storage: { remove: vi.fn() },
      audit: { append: vi.fn() },
      ids: new RandomIdGenerator(),
      unitOfWork,
      publish,
    });
    const actor = admin.actor!;

    const meeting = await useCases.createColumn(actor, projectId, { name: "Встреча" });
    await useCases.updateColumn(actor, projectId, meeting.id, { name: "Звонок" });
    await useCases.deleteColumn(actor, projectId, meeting.id);

    expect(publish.mock.calls).toEqual([
      [{ kind: "crm.changed", orgId: actor.orgId, board: projectId }],
      [{ kind: "crm.changed", orgId: actor.orgId, board: projectId }],
      [{ kind: "crm.changed", orgId: actor.orgId, board: projectId }],
    ]);
  });

  it("documents the column operations", async () => {
    const doc = (await request(app).get("/api/openapi.json")).body;

    expect(doc.paths["/api/crm/boards/{boardKey}/columns"]).toHaveProperty("get");
    expect(doc.paths["/api/crm/boards/{boardKey}/columns"]).toHaveProperty("post");
    expect(doc.paths["/api/crm/boards/{boardKey}/columns/{id}"]).toHaveProperty("patch");
    expect(doc.paths["/api/crm/boards/{boardKey}/columns/{id}"]).toHaveProperty("delete");
  });
});
