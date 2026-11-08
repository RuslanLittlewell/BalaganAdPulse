import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { PrismaUnitOfWork } from "../../src/shared/infrastructure/prisma-unit-of-work.js";
import { RandomIdGenerator } from "../../src/shared/infrastructure/id-generator.js";
import { createLeadFieldUseCases, createLeadIntake } from "../../src/modules/leads/index.js";
import { PrismaLeadRepository } from "../../src/modules/leads/infrastructure/prisma-lead-repository.js";
import { PrismaLeadFieldRepository } from "../../src/modules/leads/infrastructure/prisma-lead-field-repository.js";
import { PrismaLeadIntakeRepository } from "../../src/modules/leads/infrastructure/prisma-lead-intake-repository.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { currentOrg, grantAccess, signInAs, type SignedIn } from "../helpers/auth.js";

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

interface Field { id: string; name: string; type: string; options: Array<{ id: string; name: string; color: string }>; position: number }

const fieldsOf = (board: string = projectId) => `/api/crm/boards/${board}/fields`;
const leadsOf = (board: string = projectId) => `/api/crm/boards/${board}/leads`;

const addField = (body: Record<string, unknown>, board: string = projectId, as = auth) =>
  request(app).post(fieldsOf(board)).set(as).send(body);
const listFields = async (board: string = projectId) =>
  (await request(app).get(fieldsOf(board)).set(auth).expect(200)).body as Field[];
const segment = async () => (await addField({
  name: "Сегмент", type: "MULTI_SELECT",
  options: [{ name: "Опт", color: "blue" }, { name: "Розница", color: "green" }, { name: "VIP", color: "red" }],
}).expect(201)).body as Field;
const budget = async () => (await addField({ name: "Бюджет", type: "NUMBER" }).expect(201)).body as Field;
const addLead = (body: Record<string, unknown>, board: string = projectId) =>
  request(app).post(leadsOf(board)).set(auth).send({ name: "Леонид", ...body });
const readLead = async (id: string) =>
  (await request(app).get(`${leadsOf()}/${id}`).set(auth).expect(200)).body as { customValues: Record<string, unknown> };

describe("board fields", () => {
  it("adds a field last on its own board only", async () => {
    const first = await addField({ name: "  Бюджет  ", type: "NUMBER" });
    expect(first.status).toBe(201);
    expect(first.body).toEqual({ id: expect.any(String), name: "Бюджет", type: "NUMBER", options: [], position: 0 });
    await addField({ name: "Встреча", type: "DATE" }).expect(201);

    expect((await listFields()).map((field) => [field.name, field.position])).toEqual([["Бюджет", 0], ["Встреча", 1]]);
    expect(await listFields(otherProjectId)).toEqual([]);
  });

  it.each([
    ["a blank name", { name: " ", type: "TEXT" }],
    ["a name over 50 characters", { name: "x".repeat(51), type: "TEXT" }],
    ["an existing name in another case", { name: "БЮДЖЕТ", type: "TEXT" }],
    ["a built-in row", { name: "источник", type: "TEXT" }],
    ["an unknown type", { name: "Рейтинг", type: "RATING" }],
    ["a list without options", { name: "Сегмент", type: "SELECT" }],
    ["a list with equal options", { name: "Сегмент", type: "SELECT", options: [{ name: "Опт", color: "blue" }, { name: "опт", color: "red" }] }],
    ["an option of an unknown color", { name: "Сегмент", type: "SELECT", options: [{ name: "Опт", color: "pink" }] }],
    ["options on a text field", { name: "Заметка", type: "TEXT", options: [{ name: "Опт", color: "blue" }] }],
  ])("refuses %s", async (_, body) => {
    await budget();

    expect((await addField(body)).status).toBe(400);
    expect(await prisma.leadField.count()).toBe(1);
  });

  it("allows the same name on another board", async () => {
    await budget();

    expect((await addField({ name: "Бюджет", type: "NUMBER" }, otherProjectId)).status).toBe(201);
  });

  it("holds at most 30 fields", async () => {
    for (let index = 0; index < 30; index += 1) await addField({ name: `Поле ${index}`, type: "TEXT" }).expect(201);

    expect((await addField({ name: "Лишнее", type: "TEXT" })).status).toBe(400);
    expect(await prisma.leadField.count()).toBe(30);
  });

  it("keeps contiguous positions under concurrent creation", async () => {
    await Promise.all(["А", "Б", "В", "Г"].map((name) => addField({ name, type: "TEXT" })));

    expect((await listFields()).map((field) => field.position)).toEqual([0, 1, 2, 3]);
  });

  it("renames a field and keeps its place", async () => {
    const field = await budget();
    await addField({ name: "Встреча", type: "DATE" }).expect(201);

    const response = await request(app).patch(`${fieldsOf()}/${field.id}`).set(auth).send({ name: "Бюджет, ₽" });

    expect(response.status).toBe(200);
    expect(response.body.map((entry: Field) => entry.name)).toEqual(["Бюджет, ₽", "Встреча"]);
  });

  it("refuses to change a field's type", async () => {
    const field = await budget();

    expect((await request(app).patch(`${fieldsOf()}/${field.id}`).set(auth).send({ type: "TEXT" })).status).toBe(400);
    expect((await listFields())[0]!.type).toBe("NUMBER");
  });

  it("moves a field and keeps the others in their relative order", async () => {
    for (const name of ["А", "Б", "В"]) await addField({ name, type: "TEXT" }).expect(201);
    const third = (await listFields())[2]!;

    await request(app).patch(`${fieldsOf()}/${third.id}`).set(auth).send({ position: 1 }).expect(200);
    expect((await listFields()).map((field) => [field.name, field.position])).toEqual([["А", 0], ["В", 1], ["Б", 2]]);

    await request(app).patch(`${fieldsOf()}/${third.id}`).set(auth).send({ position: 99 }).expect(200);
    expect((await listFields()).map((field) => field.name)).toEqual(["А", "Б", "В"]);

    expect((await request(app).patch(`${fieldsOf()}/${third.id}`).set(auth).send({ position: -1 })).status).toBe(400);
    expect((await request(app).patch(`${fieldsOf()}/${third.id}`).set(auth).send({ position: 1.5 })).status).toBe(400);
  });

  it("deletes a field, clears its values and closes the gap", async () => {
    const [first] = [await budget(), await addField({ name: "Встреча", type: "DATE" }).expect(201)];
    const lead = (await addLead({ customValues: { [first!.id]: "1000" } })).body;

    await request(app).delete(`${fieldsOf()}/${first!.id}`).set(auth).expect(204);

    expect((await listFields()).map((field) => [field.name, field.position])).toEqual([["Встреча", 0]]);
    expect((await readLead(lead.id)).customValues).toEqual({});
  });

  it("does not reach a field through another board", async () => {
    const foreign = (await addField({ name: "Чужое", type: "TEXT" }, otherProjectId).expect(201)).body as Field;

    expect((await request(app).patch(`${fieldsOf()}/${foreign.id}`).set(auth).send({ name: "Моё" })).status).toBe(404);
    expect((await request(app).delete(`${fieldsOf()}/${foreign.id}`).set(auth)).status).toBe(404);
    expect((await listFields(otherProjectId))[0]!.name).toBe("Чужое");
  });
});

describe("list options", () => {
  it("keeps an option's identity when it is renamed, recolored and moved", async () => {
    const field = await segment();
    const [wholesale, retail, vip] = field.options;
    const lead = (await addLead({ customValues: { [field.id]: [retail!.id] } })).body;

    const response = await request(app).patch(`${fieldsOf()}/${field.id}`).set(auth).send({
      options: [{ id: retail!.id, name: "Small", color: "gray" }, { id: wholesale!.id, name: "Опт", color: "blue" }, { id: vip!.id, name: "VIP", color: "red" }],
    });

    expect(response.status).toBe(200);
    expect(response.body[0].options.map((option: { name: string }) => option.name)).toEqual(["Small", "Опт", "VIP"]);
    expect((await readLead(lead.id)).customValues).toEqual({ [field.id]: [retail!.id] });
  });

  it("adds an option sent without an id", async () => {
    const field = await segment();

    const response = await request(app).patch(`${fieldsOf()}/${field.id}`).set(auth).send({
      options: [...field.options, { name: "Партнёр", color: "purple" }],
    });

    expect(response.body[0].options).toHaveLength(4);
    expect(response.body[0].options[3]).toEqual({ id: expect.any(String), name: "Партнёр", color: "purple" });
  });

  it("clears a removed option from every lead and records which leads lost it", async () => {
    const field = await segment();
    const [wholesale, , vip] = field.options;
    const both = (await addLead({ customValues: { [field.id]: [wholesale!.id, vip!.id] } })).body;
    const onlyVip = (await addLead({ customValues: { [field.id]: [vip!.id] } })).body;
    const none = (await addLead({})).body;

    await request(app).patch(`${fieldsOf()}/${field.id}`).set(auth)
      .send({ options: field.options.filter((option) => option.id !== vip!.id) }).expect(200);

    expect((await readLead(both.id)).customValues).toEqual({ [field.id]: [wholesale!.id] });
    expect((await readLead(onlyVip.id)).customValues).toEqual({});
    expect((await readLead(none.id)).customValues).toEqual({});
    const event = await prisma.auditEvent.findFirstOrThrow({ where: { entityType: "lead-field", action: "UPDATE" } });
    expect((event.changes as { clearedLeadIds: string[] }).clearedLeadIds.sort()).toEqual([both.id, onlyVip.id].sort());
  });

  it("refuses an option id the field does not have", async () => {
    const field = await segment();
    const other = await addField({ name: "Канал", type: "SELECT", options: [{ name: "Сайт", color: "teal" }] }).expect(201);

    const response = await request(app).patch(`${fieldsOf()}/${field.id}`).set(auth)
      .send({ options: [{ id: other.body.options[0].id, name: "Сайт", color: "teal" }] });

    expect(response.status).toBe(400);
    expect((await listFields())[0]!.options).toHaveLength(3);
  });
});

describe("lead values", () => {
  it("stores values of every type when a lead is created", async () => {
    const number = await budget();
    const list = await segment();
    const types = {
      text: (await addField({ name: "Комментарий", type: "TEXT" })).body as Field,
      date: (await addField({ name: "Встреча", type: "DATE" })).body as Field,
      check: (await addField({ name: "Квалифицирован", type: "CHECKBOX" })).body as Field,
      link: (await addField({ name: "Бриф", type: "LINK" })).body as Field,
      single: (await addField({ name: "Канал", type: "SELECT", options: [{ name: "Сайт", color: "teal" }] })).body as Field,
    };

    const created = await addLead({
      customValues: {
        [number.id]: "-1500.5",
        [list.id]: [list.options[2]!.id, list.options[0]!.id],
        [types.text.id]: "  Перезвонить  ",
        [types.date.id]: "2026-11-12",
        [types.check.id]: true,
        [types.link.id]: "https://example.com/brief",
        [types.single.id]: types.single.options[0]!.id,
      },
    });

    expect(created.status).toBe(201);
    expect(created.body.customValues).toEqual({
      [number.id]: "-1500.5000",
      [list.id]: [list.options[0]!.id, list.options[2]!.id],
      [types.text.id]: "Перезвонить",
      [types.date.id]: "2026-11-12",
      [types.check.id]: true,
      [types.link.id]: "https://example.com/brief",
      [types.single.id]: types.single.options[0]!.id,
    });
  });

  it("starts a lead with no values", async () => {
    expect((await addLead({})).body.customValues).toEqual({});
  });

  it("changes only the named fields and clears a field set to null or empty", async () => {
    const number = await budget();
    const list = await segment();
    const lead = (await addLead({ customValues: { [number.id]: "1000", [list.id]: [list.options[0]!.id] } })).body;

    await request(app).patch(`${leadsOf()}/${lead.id}`).set(auth).send({ customValues: { [number.id]: "2000" } }).expect(200);
    expect((await readLead(lead.id)).customValues).toEqual({ [number.id]: "2000.0000", [list.id]: [list.options[0]!.id] });

    await request(app).patch(`${leadsOf()}/${lead.id}`).set(auth).send({ customValues: { [list.id]: null } }).expect(200);
    await request(app).patch(`${leadsOf()}/${lead.id}`).set(auth).send({ customValues: { [number.id]: "" } }).expect(200);
    expect((await readLead(lead.id)).customValues).toEqual({});
  });

  it("keeps the values when a lead is edited without naming them", async () => {
    const number = await budget();
    const lead = (await addLead({ customValues: { [number.id]: "1000" } })).body;

    await request(app).patch(`${leadsOf()}/${lead.id}`).set(auth).send({ notes: "Перезвонить" }).expect(200);

    expect((await readLead(lead.id)).customValues).toEqual({ [number.id]: "1000.0000" });
  });

  it.each([
    ["text in a number field", "NUMBER", "много"],
    ["an impossible day", "DATE", "2026-02-30"],
    ["a non-web link", "LINK", "javascript:alert(1)"],
    ["text in a checkbox", "CHECKBOX", "да"],
  ])("refuses %s and changes nothing", async (_, type, value) => {
    const field = (await addField({ name: "Поле", type })).body as Field;
    const lead = (await addLead({})).body;

    expect((await request(app).patch(`${leadsOf()}/${lead.id}`).set(auth).send({ notes: "1", customValues: { [field.id]: value } })).status).toBe(400);
    expect((await addLead({ name: "Второй", customValues: { [field.id]: value } })).status).toBe(400);
    const stored = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect([stored.notes, stored.customValues]).toEqual([null, {}]);
    expect(await prisma.lead.count()).toBe(1);
  });

  it("refuses a field of another board", async () => {
    const foreign = (await addField({ name: "Чужое", type: "TEXT" }, otherProjectId).expect(201)).body as Field;
    const lead = (await addLead({})).body;

    expect((await request(app).patch(`${leadsOf()}/${lead.id}`).set(auth).send({ customValues: { [foreign.id]: "x" } })).status).toBe(400);
    expect((await readLead(lead.id)).customValues).toEqual({});
  });

  it("refuses an option of another field", async () => {
    const list = await segment();
    const other = (await addField({ name: "Канал", type: "SELECT", options: [{ name: "Сайт", color: "teal" }] })).body as Field;

    expect((await addLead({ customValues: { [other.id]: list.options[0]!.id } })).status).toBe(400);
  });

  it("gives a lead imported from Meta no values", async () => {
    await budget();
    const unitOfWork = new PrismaUnitOfWork(prisma);
    const intake = createLeadIntake({ intake: new PrismaLeadIntakeRepository(unitOfWork), ids: new RandomIdGenerator(), unitOfWork, publish: vi.fn() });

    await unitOfWork.run((context) => intake.deliver(context, {
      orgId: admin.actor!.orgId, projectId,
      leads: [{
        externalId: "L1", name: "Из формы", company: null, phone: null, email: null,
        source: {
          accountId: "1", formId: "f", campaign: { externalId: "c", name: "Весна" }, adSet: { externalId: "s", name: "S" },
          ad: { externalId: "a", name: "A" }, submittedAt: new Date("2026-11-01T10:00:00Z"), answers: [], answersOmitted: false,
        },
      }],
    }));

    const [imported] = (await request(app).get(leadsOf()).set(auth).expect(200)).body;
    expect(imported.customValues).toEqual({});
  });
});

describe("who manages fields", () => {
  it.each(["MANAGER", "CLIENT", "CLIENT_ADMIN"] as const)("lets %s manage the fields of a board they reach", async (role) => {
    const member = await signInAs("Member", { role });
    await grantAccess(member.membership!.id, clientId);

    const created = await addField({ name: "Бюджет", type: "NUMBER" }, projectId, member.auth);
    expect(created.status).toBe(201);
    await request(app).patch(`${fieldsOf()}/${created.body.id}`).set(member.auth).send({ name: "Сумма" }).expect(200);
    await request(app).delete(`${fieldsOf()}/${created.body.id}`).set(member.auth).expect(204);
  });

  it("lets a guest list fields and change none", async () => {
    const field = await budget();
    const guest = await signInAs("Guest", { role: "GUEST" });
    await grantAccess(guest.membership!.id, clientId);

    expect((await request(app).get(fieldsOf()).set(guest.auth)).status).toBe(200);
    expect((await addField({ name: "Гость", type: "TEXT" }, projectId, guest.auth)).status).toBe(403);
    expect((await request(app).patch(`${fieldsOf()}/${field.id}`).set(guest.auth).send({ name: "Гость" })).status).toBe(403);
    expect((await request(app).delete(`${fieldsOf()}/${field.id}`).set(guest.auth)).status).toBe(403);
    expect((await listFields()).map((entry) => entry.name)).toEqual(["Бюджет"]);
  });

  it("answers 404 for a board the member does not reach", async () => {
    const foreign = await seedProject("unused", "Чужой");
    const customer = await signInAs("Customer", { role: "CLIENT" });
    await grantAccess(customer.membership!.id, clientId);

    expect((await request(app).get(fieldsOf(foreign.projectId)).set(customer.auth)).status).toBe(404);
    expect((await addField({ name: "Чужое", type: "TEXT" }, foreign.projectId, customer.auth)).status).toBe(404);
  });
});

describe("auditing and synchronizing fields", () => {
  it("records each change with the board, and nothing for a refused one", async () => {
    const field = await budget();
    const lead = (await addLead({ customValues: { [field.id]: "5" } })).body;
    await request(app).patch(`${fieldsOf()}/${field.id}`).set(auth).send({ name: "Сумма" }).expect(200);
    await addField({ name: "Источник", type: "TEXT" }).expect(400);
    await request(app).delete(`${fieldsOf()}/${field.id}`).set(auth).expect(204);

    const events = await prisma.auditEvent.findMany({ where: { entityType: "lead-field" }, orderBy: { createdAt: "asc" } });
    expect(events.map((event) => [event.action, event.entityId, event.projectId, event.clientId])).toEqual([
      ["CREATE", field.id, projectId, clientId],
      ["UPDATE", field.id, projectId, clientId],
      ["DELETE", field.id, projectId, clientId],
    ]);
    expect((events[2]!.changes as { clearedLeadIds: string[] }).clearedLeadIds).toEqual([lead.id]);
  });

  it("keeps field events out of another client's audit history", async () => {
    await budget();
    const foreign = await seedProject("unused", "Чужой");
    const customer = await signInAs("Customer", { role: "CLIENT" });
    await grantAccess(customer.membership!.id, foreign.clientId);

    const history = await request(app).get("/api/audit?entityType=lead-field").set(customer.auth);

    expect(history.body.items ?? []).toEqual([]);
  });

  it("tells open boards that the fields changed", async () => {
    const unitOfWork = new PrismaUnitOfWork(prisma);
    const publish = vi.fn();
    const useCases = createLeadFieldUseCases({
      leads: new PrismaLeadRepository(prisma, unitOfWork),
      fields: new PrismaLeadFieldRepository(prisma, unitOfWork),
      audit: { append: vi.fn() },
      ids: new RandomIdGenerator(),
      unitOfWork,
      publish,
    });
    const actor = admin.actor!;

    const field = await useCases.create(actor, projectId, { name: "Бюджет", type: "NUMBER" });
    await useCases.update(actor, projectId, field.id, { name: "Сумма" });
    await useCases.delete(actor, projectId, field.id);
    await expect(useCases.create(actor, projectId, { name: "Компания", type: "TEXT" })).rejects.toThrow();

    expect(publish.mock.calls).toEqual(Array.from({ length: 3 }, () => [{ kind: "crm.changed", orgId: actor.orgId, board: projectId, resources: ['fields', 'leads', 'activity'] }]));
  });
});

describe("removing the project", () => {
  it("removes its fields with its leads and leaves other boards alone", async () => {
    await budget();
    await addField({ name: "Бюджет", type: "NUMBER" }, otherProjectId).expect(201);

    await request(app).delete(`/api/projects/${projectId}`).set(auth).expect(204);

    expect(await prisma.leadField.findMany({ select: { projectId: true } })).toEqual([{ projectId: otherProjectId }]);
  });
});

describe("the migration", () => {
  const statementsOf = (sql: string) => sql.split(";")
    .map((statement) => statement.split("\n").filter((line) => !line.trim().startsWith("--")).join("\n").trim())
    .filter(Boolean);

  it("gives every existing lead an empty value set", async () => {
    const schema = `migration_${randomUUID().replaceAll("-", "")}`;
    const sql = readFileSync(new URL("../../prisma/migrations/20261108120000_lead_custom_fields/migration.sql", import.meta.url), "utf8");
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
      await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
      await tx.$executeRawUnsafe('CREATE TABLE "organization" (id TEXT PRIMARY KEY)');
      await tx.$executeRawUnsafe('CREATE TABLE "project" (id TEXT PRIMARY KEY)');
      await tx.$executeRawUnsafe('CREATE TABLE "lead" (id TEXT PRIMARY KEY)');
      await tx.$executeRawUnsafe(`INSERT INTO "lead" VALUES ('anna'), ('boris')`);

      for (const statement of statementsOf(sql)) await tx.$executeRawUnsafe(statement);

      const rows = await tx.$queryRawUnsafe<Array<{ id: string; custom_values: unknown }>>('SELECT id, custom_values FROM "lead" ORDER BY id');
      expect(rows).toEqual([{ id: "anna", custom_values: {} }, { id: "boris", custom_values: {} }]);
      await tx.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
    });
  });
});
