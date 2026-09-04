import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb } from "../helpers/db.js";
import { signInAs } from "../helpers/auth.js";

const app = createApp();

const CONTACT = {
  name: "Acme",
  fullName: "Иван Иванов",
  organization: 'ООО "Акме"',
  unp: "123456789",
  phone: "+375 29 000-00-00",
  telegram: "@acme",
  email: "hello@acme.by",
  website: "https://acme.by",
};

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

let auth: { Authorization: string };

beforeEach(async () => {
  await resetDb();
  ({ auth } = await signInAs());
});
afterAll(async () => { await prisma.$disconnect(); });

describe("the contact book survives the move to organization ownership", () => {
  it("stores and returns every contact field", async () => {
    const created = await request(app).post("/api/clients").set(auth).send(CONTACT);
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject(CONTACT);

    const read = await request(app).get(`/api/clients/${created.body.id}`).set(auth);
    expect(read.body).toMatchObject(CONTACT);
  });

  it("carries every contact field in the list, so the contact book needs no second call", async () => {
    await request(app).post("/api/clients").set(auth).send(CONTACT);
    const list = await request(app).get("/api/clients").set(auth);
    expect(list.body[0]).toMatchObject(CONTACT);
  });

  it("edits one contact field and leaves the rest alone", async () => {
    const created = await request(app).post("/api/clients").set(auth).send(CONTACT);
    const updated = await request(app).patch(`/api/clients/${created.body.id}`)
      .set(auth).send({ phone: "+375 44 111-11-11" });

    expect(updated.body.phone).toBe("+375 44 111-11-11");
    expect(updated.body).toMatchObject({ ...CONTACT, phone: "+375 44 111-11-11" });
  });

  it("clears a contact field when it is sent as null", async () => {
    const created = await request(app).post("/api/clients").set(auth).send(CONTACT);
    const updated = await request(app).patch(`/api/clients/${created.body.id}`)
      .set(auth).send({ telegram: null });
    expect(updated.body.telegram).toBeNull();
  });

  it("keeps the client's picture", async () => {
    const created = await request(app).post("/api/clients").set(auth).send({ name: "Acme" });
    const uploaded = await request(app).put(`/api/clients/${created.body.id}/avatar`)
      .set(auth)
      .field("avatarPath", '{"topType":"NoHair"}')
      .attach("image", PNG, { filename: "a.png", contentType: "image/png" });

    expect(uploaded.status).toBe(200);
    expect(uploaded.body.image).toMatch(/^data:image\/png;base64,/);
    expect(uploaded.body.avatarPath).toBe('{"topType":"NoHair"}');

    const read = await request(app).get(`/api/clients/${created.body.id}`).set(auth);
    expect(read.body.image).toMatch(/^data:image\/png;base64,/);
  });

  it("stores the client against the organization, not against a person", async () => {
    const created = await request(app).post("/api/clients").set(auth).send({ name: "Acme" });
    const stored = await prisma.client.findUniqueOrThrow({ where: { id: created.body.id } });
    const org = await prisma.organization.findFirstOrThrow();
    expect(stored.orgId).toBe(org.id);
  });
});
