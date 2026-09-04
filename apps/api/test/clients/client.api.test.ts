import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { resetDb } from "../helpers/db.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { grantAccess, signInAs } from "../helpers/auth.js";
import { expectAudit } from "../helpers/audit.js";

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
    await expectAudit({ action: "CREATE", entityType: "client", entityId: res.body.id, clientId: res.body.id });
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
    await expectAudit({ action: "UPDATE", entityType: "client", entityId: c.body.id, clientId: c.body.id });
  });
  it("DELETE /api/clients/:id deletes (204)", async () => {
    const c = await request(app).post("/api/clients").set(auth).send({ name: "A" });
    const res = await request(app).delete(`/api/clients/${c.body.id}`).set(auth);
    expect(res.status).toBe(204);
    await expectAudit({ action: "DELETE", entityType: "client", entityId: c.body.id, clientId: c.body.id });
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
  it("GET /api/clients lists only the clients the caller can reach", async () => {
    const mine = await signInAs("Mine", { role: "MANAGER" });
    const other = await signInAs("Other", { role: "MANAGER" });
    await request(app).post("/api/clients").set(mine.auth).send({ name: "Mine" });
    await request(app).post("/api/clients").set(other.auth).send({ name: "Theirs" });

    const res = await request(app).get("/api/clients").set(mine.auth);
    expect(res.status).toBe(200);
    expect(res.body.map((client: { name: string }) => client.name)).toEqual(["Mine"]);
  });

  it("GET /api/clients shows an admin every client of the organization", async () => {
    const other = await signInAs("Other", { role: "MANAGER" });
    await request(app).post("/api/clients").set(other.auth).send({ name: "Theirs" });
    await request(app).post("/api/clients").set(auth).send({ name: "Mine" });

    const res = await request(app).get("/api/clients").set(auth);
    expect(res.body.map((client: { name: string }) => client.name).sort())
      .toEqual(["Mine", "Theirs"]);
  });

  it("GET /api/clients/:id for an unreachable client -> 404", async () => {
    const other = await signInAs("Other", { role: "MANAGER" });
    const stranger = await signInAs("Stranger", { role: "MANAGER" });
    const theirs = await request(app).post("/api/clients").set(other.auth).send({ name: "Theirs" });

    const res = await request(app).get(`/api/clients/${theirs.body.id}`).set(stranger.auth);
    expect(res.status).toBe(404);
  });

  it("DELETE /api/clients/:id for an unreachable client -> 404 and keeps it", async () => {
    const other = await signInAs("Other", { role: "MANAGER" });
    const stranger = await signInAs("Stranger", { role: "MANAGER" });
    const theirs = await request(app).post("/api/clients").set(other.auth).send({ name: "Theirs" });

    const res = await request(app).delete(`/api/clients/${theirs.body.id}`).set(stranger.auth);
    expect(res.status).toBe(404);
    expect(await prisma.client.count()).toBe(1);
  });
});

describe("Client avatars", () => {
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
    await expectAudit({ action: "UPDATE", entityType: "client", entityId: id, clientId: id });
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

  describe("creating a client grants its creator", () => {
    it("gives a manager reach over the client they entered", async () => {
      const manager = await signInAs("Manager", { role: "MANAGER" });
      const created = await request(app).post("/api/clients").set(manager.auth).send({ name: "Mine" });
      expect(created.status).toBe(201);

      const read = await request(app).get(`/api/clients/${created.body.id}`).set(manager.auth);
      expect(read.status).toBe(200);
      const grants = await prisma.clientAccess.findMany({
        where: { membershipId: manager.membership!.id },
      });
      expect(grants.map((grant) => grant.clientId)).toEqual([created.body.id]);
    });

    it("records no grant for an admin, whose role already reaches everything", async () => {
      const created = await request(app).post("/api/clients").set(auth).send({ name: "Theirs" });
      expect(created.status).toBe(201);
      expect(await prisma.clientAccess.count()).toBe(0);
    });
  });

  describe("role permissions", () => {
    it("refuses a guest every write and allows every read", async () => {
      const admin = await signInAs("Admin", { role: "ADMIN" });
      const created = await request(app).post("/api/clients").set(admin.auth).send({ name: "Acme" });
      const guest = await signInAs("Guest", { role: "GUEST" });
      await grantAccess(guest.membership!.id, created.body.id);

      expect((await request(app).get(`/api/clients/${created.body.id}`).set(guest.auth)).status).toBe(200);
      expect((await request(app).post("/api/clients").set(guest.auth).send({ name: "No" })).status).toBe(403);
      expect((await request(app).patch(`/api/clients/${created.body.id}`).set(guest.auth).send({ name: "No" })).status).toBe(403);
      expect((await request(app).delete(`/api/clients/${created.body.id}`).set(guest.auth)).status).toBe(403);
    });

    it("lets a manager edit but never delete", async () => {
      const manager = await signInAs("Manager", { role: "MANAGER" });
      const created = await request(app).post("/api/clients").set(manager.auth).send({ name: "Mine" });

      expect((await request(app).patch(`/api/clients/${created.body.id}`).set(manager.auth).send({ name: "Renamed" })).status).toBe(200);
      expect((await request(app).delete(`/api/clients/${created.body.id}`).set(manager.auth)).status).toBe(403);
      expect(await prisma.client.count()).toBe(1);
    });
  });
});
