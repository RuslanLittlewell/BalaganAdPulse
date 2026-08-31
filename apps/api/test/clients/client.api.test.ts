import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { resetDb } from "../helpers/db.js";
import { prisma } from "../../src/lib/prisma.js";
import { signInAs } from "../helpers/auth.js";

const app = createApp();
const MISSING = "00000000-0000-0000-0000-000000000000";

let auth: { Authorization: string };

beforeEach(async () => {
  await resetDb();
  ({ auth } = await signInAs());
});
afterAll(async () => { await prisma.$disconnect(); });

describe("Clients API", () => {
  it("POST /api/clients creates (201)", async () => {
    const res = await request(app).post("/api/clients").set(auth).send({ name: "Acme" });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Acme");
  });
  it("POST /api/clients with empty name -> 400", async () => {
    const res = await request(app).post("/api/clients").set(auth).send({ name: "" });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBeTruthy();
  });
  it("GET /api/clients returns the list (200)", async () => {
    await request(app).post("/api/clients").set(auth).send({ name: "A" });
    const res = await request(app).get("/api/clients").set(auth);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });
  it("GET /api/clients/:id for a missing id -> 404", async () => {
    const res = await request(app).get(`/api/clients/${MISSING}`).set(auth);
    expect(res.status).toBe(404);
  });
  it("PATCH /api/clients/:id updates (200)", async () => {
    const c = await request(app).post("/api/clients").set(auth).send({ name: "A" });
    const res = await request(app).patch(`/api/clients/${c.body.id}`).set(auth).send({ phone: "+375 29 000-00-00" });
    expect(res.status).toBe(200);
    expect(res.body.phone).toBe("+375 29 000-00-00");
  });
  it("DELETE /api/clients/:id deletes (204)", async () => {
    const c = await request(app).post("/api/clients").set(auth).send({ name: "A" });
    const res = await request(app).delete(`/api/clients/${c.body.id}`).set(auth);
    expect(res.status).toBe(204);
  });
  it("POST /api/clients stores and returns the contact details", async () => {
    const details = {
      fullName: "Иван Петров",
      organization: "ООО «Акме»",
      unp: "191234567",
      phone: "+375 29 123-45-67",
      telegram: "@acme",
      email: "ivan@acme.by",
      website: "https://acme.by",
    };
    const res = await request(app).post("/api/clients").set(auth).send({ name: "Acme", ...details });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject(details);
  });
  it("GET /api/clients returns the contact details, so the contact book needs no extra call", async () => {
    await request(app).post("/api/clients").set(auth).send({ name: "Acme", unp: "191234567", telegram: "@acme" });
    const res = await request(app).get("/api/clients").set(auth);

    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({ unp: "191234567", telegram: "@acme" });
  });
  it("PATCH /api/clients/:id updates one contact field and leaves the rest", async () => {
    const created = await request(app).post("/api/clients").set(auth)
      .send({ name: "Acme", unp: "191234567", phone: "+375 29 123-45-67" });
    const res = await request(app).patch(`/api/clients/${created.body.id}`).set(auth)
      .send({ phone: "+375 44 000-00-00" });

    expect(res.status).toBe(200);
    expect(res.body.phone).toBe("+375 44 000-00-00");
    expect(res.body.unp).toBe("191234567");
  });
  it("clears a contact field when it is sent as null", async () => {
    const created = await request(app).post("/api/clients").set(auth)
      .send({ name: "Acme", unp: "191234567", phone: "+375 29 123-45-67" });
    const res = await request(app).patch(`/api/clients/${created.body.id}`).set(auth)
      .send({ unp: null });

    expect(res.status).toBe(200);
    expect(res.body.unp).toBeNull();
    expect(res.body.phone).toBe("+375 29 123-45-67");
  });
  it("leaves contact details null when they were never supplied", async () => {
    const res = await request(app).post("/api/clients").set(auth).send({ name: "Acme" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      fullName: null, organization: null, unp: null, phone: null, telegram: null, website: null,
    });
  });
  it("GET /api/clients only lists the caller's clients", async () => {
    await request(app).post("/api/clients").set(auth).send({ name: "Mine" });
    const other = await signInAs("Other");
    await request(app).post("/api/clients").set(other.auth).send({ name: "Theirs" });

    const res = await request(app).get("/api/clients").set(auth);
    expect(res.status).toBe(200);
    expect(res.body.map((client: { name: string }) => client.name)).toEqual(["Mine"]);
  });

  it("GET /api/clients/:id for another user's client -> 404", async () => {
    const other = await signInAs("Other");
    const theirs = await request(app).post("/api/clients").set(other.auth).send({ name: "Theirs" });

    const res = await request(app).get(`/api/clients/${theirs.body.id}`).set(auth);
    expect(res.status).toBe(404);
  });

  it("DELETE /api/clients/:id for another user's client -> 404 and keeps it", async () => {
    const other = await signInAs("Other");
    const theirs = await request(app).post("/api/clients").set(other.auth).send({ name: "Theirs" });

    const res = await request(app).delete(`/api/clients/${theirs.body.id}`).set(auth);
    expect(res.status).toBe(404);
    expect(await prisma.client.count()).toBe(1);
  });
});

describe("Client avatars", () => {
  // The smallest thing that is genuinely a PNG: signature plus a 1x1 image.
  const PNG = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
  const CONFIG = JSON.stringify({ source: "upload" });

  async function client(name = "Acme") {
    const res = await request(app).post("/api/clients").set(auth).send({ name });
    return res.body.id as string;
  }

  it("stores a PNG and hands it back inside the client", async () => {
    const id = await client();
    const res = await request(app).put(`/api/clients/${id}/avatar`).set(auth)
      .field("avatarPath", CONFIG)
      .attach("image", PNG, { filename: "avatar.png", contentType: "image/png" });

    expect(res.status).toBe(200);
    expect(res.body.image).toMatch(/^data:image\/png;base64,/);
    expect(res.body.avatarPath).toBe(CONFIG);
  });

  it("carries the picture in the list, so the contact book fetches nothing", async () => {
    const id = await client();
    await request(app).put(`/api/clients/${id}/avatar`).set(auth)
      .field("avatarPath", CONFIG)
      .attach("image", PNG, { filename: "avatar.png", contentType: "image/png" });

    const list = await request(app).get("/api/clients").set(auth);

    expect(list.status).toBe(200);
    expect(list.body[0].image).toMatch(/^data:image\/png;base64,/);
  });

  it("reports no picture before one is uploaded", async () => {
    const id = await client();
    const res = await request(app).get(`/api/clients/${id}`).set(auth);
    expect(res.body.image).toBeNull();
  });

  it("answers 404 for the avatar endpoint that no longer exists", async () => {
    const id = await client();
    const res = await request(app).get(`/api/clients/${id}/avatar`).set(auth);
    expect(res.status).toBe(404);
  });

  it("refuses an upload for a client the caller does not own", async () => {
    const res = await request(app).put(`/api/clients/${MISSING}/avatar`).set(auth)
      .field("avatarPath", CONFIG)
      .attach("image", PNG, { filename: "avatar.png", contentType: "image/png" });

    expect(res.status).toBe(404);
  });

  it("rejects a file that is not a PNG", async () => {
    const id = await client();
    const res = await request(app).put(`/api/clients/${id}/avatar`).set(auth)
      .field("avatarPath", CONFIG)
      .attach("image", Buffer.from("not a png"), { filename: "a.txt", contentType: "text/plain" });

    expect(res.status).toBe(400);
  });

  it("rejects a configuration that is not JSON", async () => {
    const id = await client();
    const res = await request(app).put(`/api/clients/${id}/avatar`).set(auth)
      .field("avatarPath", "not json")
      .attach("image", PNG, { filename: "avatar.png", contentType: "image/png" });

    expect(res.status).toBe(400);
  });
});
