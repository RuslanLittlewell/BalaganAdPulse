import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { grantAccess, signInAs, signInAsOutsider } from "../helpers/auth.js";

const app = createApp();

type Auth = { Authorization: string };

let admin: Auth;
let clientId: string;
let projectId: string;

beforeEach(async () => {
  await resetDb();
  const signedIn = await signInAs("Админ", { role: "ADMIN" });
  admin = signedIn.auth;
  ({ clientId, projectId } = await seedProject(signedIn.user.id, "Acme"));
});
afterAll(() => prisma.$disconnect());

const documents = (id = projectId) => `/api/projects/${id}/documents`;
const create = (title: unknown, auth: Auth = admin, id = projectId) =>
  request(app).post(documents(id)).set(auth).send({ title });
const change = (documentId: string, body: Record<string, unknown>, auth: Auth = admin) =>
  request(app).patch(`${documents()}/${documentId}`).set(auth).send(body);
const paragraph = (text: string) => ({
  type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

async function member(role: "MANAGER" | "GUEST" | "CLIENT" | "CLIENT_ADMIN", name = role) {
  const signed = await signInAs(name, { role });
  await grantAccess(signed.membership!.id, clientId);
  return signed;
}

describe("a project's documents", () => {
  it("are created empty, titled as given and trimmed, and listed in the order they were created", async () => {
    const first = await create("  О проекте  ");
    await create("Стратегия");
    await create("Конкуренты");

    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ title: "О проекте", projectId, content: null, createdBy: { name: "Админ" } });
    const listed = await request(app).get(documents()).set(admin);
    expect(listed.body.map((entry: { title: string }) => entry.title)).toEqual(["О проекте", "Стратегия", "Конкуренты"]);
    expect(listed.body[0]).not.toHaveProperty("content");
  });

  it("are listed with the beginning of their text, and without the text itself", async () => {
    const created = await create("Аналитика");
    const saved = await change(created.body.id, { content: {
      type: "doc", content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Коротко" }] },
        { type: "paragraph", content: [{ type: "text", text: "Почти все агентства строят анализ" }] },
      ],
    } });

    expect(saved.body.excerpt).toBe("Коротко\nПочти все агентства строят анализ");
    const listed = await request(app).get(documents()).set(admin);
    expect(listed.body[0]).toMatchObject({ title: "Аналитика", excerpt: "Коротко\nПочти все агентства строят анализ" });
    expect(listed.body[0]).not.toHaveProperty("content");
    expect((await create("Пустой")).body.excerpt).toBe("");
  });

  it("keep the text they are given and say who changed them last", async () => {
    const created = await create("О проекте");
    const manager = await member("MANAGER", "Роман");

    const saved = await change(created.body.id, { content: paragraph("Клиника эстетической медицины") }, manager.auth);

    expect(saved.status).toBe(200);
    const read = await request(app).get(`${documents()}/${created.body.id}`).set(admin);
    expect(read.body).toMatchObject({ content: paragraph("Клиника эстетической медицины"), updatedBy: { name: "Роман" } });
  });

  it("keep the version saved last", async () => {
    const created = await create("Стратегия");
    const manager = await member("MANAGER");

    await change(created.body.id, { content: paragraph("Первая версия") });
    await change(created.body.id, { content: paragraph("Вторая версия") }, manager.auth);

    expect((await request(app).get(`${documents()}/${created.body.id}`).set(admin)).body.content).toEqual(paragraph("Вторая версия"));
  });

  it("are renamed without losing their text", async () => {
    const created = await create("Стратегия");
    await change(created.body.id, { content: paragraph("План") });

    const renamed = await change(created.body.id, { title: "Стратегия на Q4" });

    expect(renamed.body).toMatchObject({ title: "Стратегия на Q4", content: paragraph("План") });
  });

  it("are deleted for good", async () => {
    const created = await create("Конкуренты");

    expect((await request(app).delete(`${documents()}/${created.body.id}`).set(admin)).status).toBe(204);
    expect((await request(app).get(`${documents()}/${created.body.id}`).set(admin)).status).toBe(404);
    expect((await request(app).get(documents()).set(admin)).body).toEqual([]);
  });

  it.each([
    ["a blank title", "   "],
    ["a title longer than 120 characters", "Я".repeat(121)],
    ["no title at all", undefined],
  ])("refuse %s -> 400", async (_, title) => {
    expect((await create(title)).status).toBe(400);
    expect((await request(app).get(documents()).set(admin)).body).toEqual([]);
  });

  it.each([
    ["text that is not a rich-text document", { type: "paragraph" }],
    ["a list instead of a document", [paragraph("x")]],
    ["text over one megabyte", paragraph("я".repeat(600_000))],
  ])("refuse %s -> 400", async (_, content) => {
    const created = await create("О проекте");

    expect((await change(created.body.id, { content })).status).toBe(400);
    expect((await request(app).get(`${documents()}/${created.body.id}`).set(admin)).body.content).toBeNull();
  });

  it("refuse a request too large to read -> 413", async () => {
    const created = await create("О проекте");

    expect((await change(created.body.id, { content: paragraph("я".repeat(1_100_000)) })).status).toBe(413);
  });

  it("leave the rest of the API at its usual body limit", async () => {
    const res = await request(app).post("/api/projects").set(admin).send({ clientId, name: "x".repeat(200_000) });

    expect(res.status).toBe(413);
  });

  it("may have their text cleared", async () => {
    const created = await create("О проекте");
    await change(created.body.id, { content: paragraph("x") });

    expect((await change(created.body.id, { content: null })).body.content).toBeNull();
  });
});

describe("who reaches a project's documents", () => {
  it("lets a manager who reaches the project write them", async () => {
    const manager = await member("MANAGER");
    const created = await create("О проекте", manager.auth);

    expect(created.status).toBe(201);
    expect((await change(created.body.id, { title: "О клиенте" }, manager.auth)).status).toBe(200);
    expect((await request(app).delete(`${documents()}/${created.body.id}`).set(manager.auth)).status).toBe(204);
  });

  it("lets a guest read them and nothing more", async () => {
    const created = await create("О проекте");
    const guest = await member("GUEST");

    expect((await request(app).get(documents()).set(guest.auth)).status).toBe(200);
    expect((await request(app).get(`${documents()}/${created.body.id}`).set(guest.auth)).status).toBe(200);
    expect((await create("Ещё", guest.auth)).status).toBe(403);
    expect((await change(created.body.id, { title: "Чужое" }, guest.auth)).status).toBe(403);
    expect((await request(app).delete(`${documents()}/${created.body.id}`).set(guest.auth)).status).toBe(403);
    expect((await request(app).get(`${documents()}/${created.body.id}`).set(admin)).body.title).toBe("О проекте");
  });

  it.each(["CLIENT", "CLIENT_ADMIN"] as const)("keeps them from a %s -> 403", async (role) => {
    const created = await create("О проекте");
    const customer = await member(role);

    expect((await request(app).get(documents()).set(customer.auth)).status).toBe(403);
    expect((await request(app).get(`${documents()}/${created.body.id}`).set(customer.auth)).status).toBe(403);
  });

  it("answers 404 for a project out of reach", async () => {
    const outsider = await signInAsOutsider();
    expect((await request(app).get(documents()).set(outsider.auth)).status).toBe(404);
    expect((await create("Чужой", outsider.auth)).status).toBe(404);
  });

  it("answers 404 for a document asked for through another project", async () => {
    const created = await create("О проекте");
    const other = await request(app).post("/api/projects").set(admin).send({ clientId, name: "Другой" });

    expect((await request(app).get(`${documents(other.body.id)}/${created.body.id}`).set(admin)).status).toBe(404);
    expect((await request(app).delete(`${documents(other.body.id)}/${created.body.id}`).set(admin)).status).toBe(404);
  });

  it("deletes a project's documents with the project", async () => {
    await create("О проекте");

    await request(app).delete(`/api/projects/${projectId}`).set(admin);

    expect(await prisma.projectDocument.count()).toBe(0);
  });
});

describe("the activity of a project's documents", () => {
  it("records creating, renaming and deleting, and not the text", async () => {
    const created = await create("О проекте");
    await change(created.body.id, { content: paragraph("x") });
    await change(created.body.id, { title: "О клиенте", content: paragraph("y") });
    await change(created.body.id, { title: "О клиенте" });
    await request(app).delete(`${documents()}/${created.body.id}`).set(admin);

    const events = await prisma.auditEvent.findMany({
      where: { entityType: "project-document" }, orderBy: { createdAt: "asc" },
    });
    expect(events.map((event) => [event.action, event.summary])).toEqual([
      ["CREATE", "Created document “О проекте”"],
      ["UPDATE", "Renamed document “О проекте” to “О клиенте”"],
      ["DELETE", "Deleted document “О клиенте”"],
    ]);
    expect(events.every((event) => event.projectId === projectId && event.clientId === clientId)).toBe(true);
  });
});
