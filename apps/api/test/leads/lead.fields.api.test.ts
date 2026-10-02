import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { signInAs } from "../helpers/auth.js";

const app = createApp();

let auth: { Authorization: string };
let projectId: string;

beforeEach(async () => {
  await resetDb();
  const member = await signInAs();
  auth = member.auth;
  ({ projectId } = await seedProject(member.user.id));
});

afterAll(() => prisma.$disconnect());

const leads = () => `/api/crm/boards/${projectId}/leads`;
const create = (body: Record<string, unknown>) =>
  request(app).post(leads()).set(auth).send({ name: "Леонид", ...body });

describe("the fields of a lead", () => {
  it("starts with no amount and no tags", async () => {
    const created = await create({});
    expect(created.body).toMatchObject({
      amount: null, service: null, telegram: null, messenger: null, tags: [],
    });
  });

  it("round trips the service, Telegram and messenger", async () => {
    const fields = { service: "Лендинг", telegram: "@leonid", messenger: "WhatsApp" };
    const created = await create(fields);

    expect(created.status).toBe(201);
    expect((await request(app).get(`${leads()}/${created.body.id}`).set(auth)).body).toMatchObject(fields);
  });

  it.each([
    { telegram: "x".repeat(101) },
    { messenger: "x".repeat(101) },
    { service: "x".repeat(201) },
  ])("refuses a field over its limit %#", async (fields) => {
    expect((await create(fields)).status).toBe(400);
    expect(await prisma.lead.count()).toBe(0);
  });

  it("carries no site type", async () => {
    expect((await create({ siteType: "Магазин" })).status).toBe(400);
    expect((await create({})).body).not.toHaveProperty("siteType");
  });
});

describe("the deal amount", () => {
  it("is exchanged as a decimal string with four places", async () => {
    const created = await create({ amount: "1500.5" });

    expect(created.status).toBe(201);
    expect(created.body.amount).toBe("1500.5000");
    const updated = await request(app).patch(`${leads()}/${created.body.id}`).set(auth).send({ amount: "0.1234" });
    expect(updated.body.amount).toBe("0.1234");
    const cleared = await request(app).patch(`${leads()}/${created.body.id}`).set(auth).send({ amount: null });
    expect(cleared.body.amount).toBeNull();
  });

  it.each(["-1", "abc", "1.23456", "123456789012345", 12])("refuses %j", async (amount) => {
    expect((await create({ amount })).status).toBe(400);
    expect(await prisma.lead.count()).toBe(0);
  });
});

describe("tags", () => {
  it("keeps trimmed tags in the order given", async () => {
    const created = await create({ tags: [" Срочно ", "VIP"] });
    expect(created.body.tags).toEqual(["Срочно", "VIP"]);
  });

  it.each([
    [["Срочно", "срочно"]],
    [[" "]],
    [["x".repeat(31)]],
    [Array.from({ length: 11 }, (_, index) => `Метка ${index}`)],
  ])("refuses %j", async (tags) => {
    expect((await create({ tags })).status).toBe(400);
    expect(await prisma.lead.count()).toBe(0);
  });

  it("replaces the whole list on update", async () => {
    const created = await create({ tags: ["Срочно"] });
    const updated = await request(app).patch(`${leads()}/${created.body.id}`).set(auth).send({ tags: ["VIP"] });
    expect(updated.body.tags).toEqual(["VIP"]);
  });
});
