import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { grantAccess, signInAs, type SignedIn } from "../helpers/auth.js";

const app = createApp();

let admin: SignedIn;
let auth: { Authorization: string };
let clientId: string;
let projectId: string;

beforeEach(async () => {
  await resetDb();
  admin = await signInAs();
  auth = admin.auth;
  ({ clientId, projectId } = await seedProject(admin.user.id));
});

afterAll(() => prisma.$disconnect());

const events = (board: string = projectId) => `/api/crm/boards/${board}/conversion-events`;
const create = (body: object, as = auth, board: string = projectId) => request(app).post(events(board)).set(as).send(body);
const addColumn = async (name: string, board: string = projectId) =>
  (await request(app).post(`/api/crm/boards/${board}/columns`).set(auth).send({ name }).expect(201)).body as { id: string };

describe("conversion events", () => {
  it("creates, lists in creation order, edits and deletes events", async () => {
    const paid = await addColumn("Оплачено");
    const sale = await create({ name: " Продажа ", stages: [paid.id], carriesAmount: true }).expect(201);
    expect(sale.body).toEqual({
      id: expect.any(String), projectId, name: "Продажа", stages: [paid.id], carriesAmount: true,
      createdAt: expect.any(String), updatedAt: expect.any(String),
    });
    const qual = await create({ name: "Квал", stages: ["QUALIFIED", paid.id, "QUALIFIED"] }).expect(201);
    expect(qual.body).toMatchObject({ name: "Квал", stages: ["QUALIFIED", paid.id], carriesAmount: false });

    expect((await request(app).get(events()).set(auth).expect(200)).body.map((event: { name: string }) => event.name)).toEqual(["Продажа", "Квал"]);

    const renamed = await request(app).patch(`${events()}/${qual.body.id}`).set(auth).send({ name: "Квалы", carriesAmount: true }).expect(200);
    expect(renamed.body).toMatchObject({ name: "Квалы", stages: ["QUALIFIED", paid.id], carriesAmount: true });

    await request(app).delete(`${events()}/${sale.body.id}`).set(auth).expect(204);
    expect((await request(app).get(events()).set(auth).expect(200)).body.map((event: { name: string }) => event.name)).toEqual(["Квалы"]);

    const audit = await prisma.auditEvent.findMany({ where: { entityType: "crm-conversion-event" }, orderBy: { createdAt: "asc" } });
    expect(audit.map((entry) => entry.action)).toEqual(["CREATE", "CREATE", "UPDATE", "DELETE"]);
    expect(audit.every((entry) => entry.projectId === projectId && entry.clientId === clientId)).toBe(true);
  });

  it("refuses a name another event has, ignoring case", async () => {
    await create({ name: "Квал", stages: ["QUALIFIED"] }).expect(201);
    await create({ name: "квал", stages: ["TARGET"] }).expect(409);
    const other = await create({ name: "Замер", stages: ["TARGET"] }).expect(201);
    await request(app).patch(`${events()}/${other.body.id}`).set(auth).send({ name: "КВАЛ" }).expect(409);
    expect(await prisma.crmConversionEvent.count()).toBe(2);
  });

  it.each([
    ["no stages", { name: "Квал", stages: [] }],
    ["a blank name", { name: "  ", stages: ["NEW"] }],
    ["a name over 50 characters", { name: "x".repeat(51), stages: ["NEW"] }],
    ["an unknown fixed stage", { name: "Квал", stages: ["WON"] }],
  ])("refuses %s", async (_label, body) => {
    await create(body).expect(400);
  });

  it("refuses a column of another project's board", async () => {
    const other = await prisma.project.create({ data: { clientId, name: "Второй", position: 1 } });
    const foreign = await addColumn("Чужая", other.id);
    await create({ name: "Квал", stages: [foreign.id] }).expect(400);
  });

  it("holds at most ten events per project", async () => {
    for (let index = 0; index < 10; index++) await create({ name: `Событие ${index}`, stages: ["NEW"] }).expect(201);
    await create({ name: "Одиннадцатое", stages: ["NEW"] }).expect(400);
  });

  it("answers 403 to a client who may edit the board and to a guest, and 404 for an unreachable project", async () => {
    const client = await signInAs("Client", { role: "CLIENT" });
    await grantAccess(client.membership!.id, clientId);
    await request(app).get(events()).set(client.auth).expect(403);
    await create({ name: "Квал", stages: ["NEW"] }, client.auth).expect(403);

    const guest = await signInAs("Guest", { role: "GUEST" });
    await grantAccess(guest.membership!.id, clientId);
    await request(app).get(events()).set(guest.auth).expect(403);

    await request(app).get(events("00000000-0000-4000-8000-000000000000")).set(auth).expect(404);
  });

  it("removes a deleted column from every event and keeps an event left without stages", async () => {
    const measure = await addColumn("Замер назначен");
    const paid = await addColumn("Оплачено");
    const only = await create({ name: "Замер", stages: [measure.id] }).expect(201);
    const mixed = await create({ name: "Квал", stages: ["QUALIFIED", measure.id, paid.id] }).expect(201);

    await request(app).delete(`/api/crm/boards/${projectId}/columns/${measure.id}`).set(auth).expect(204);

    const listed = (await request(app).get(events()).set(auth).expect(200)).body as Array<{ id: string; stages: string[] }>;
    expect(listed.find((event) => event.id === only.body.id)?.stages).toEqual([]);
    expect(listed.find((event) => event.id === mixed.body.id)?.stages).toEqual(["QUALIFIED", paid.id]);
  });
});
