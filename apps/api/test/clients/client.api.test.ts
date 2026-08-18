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
    const res = await request(app).patch(`/api/clients/${c.body.id}`).set(auth).send({ niche: "fitness" });
    expect(res.status).toBe(200);
    expect(res.body.niche).toBe("fitness");
  });
  it("DELETE /api/clients/:id deletes (204)", async () => {
    const c = await request(app).post("/api/clients").set(auth).send({ name: "A" });
    const res = await request(app).delete(`/api/clients/${c.body.id}`).set(auth);
    expect(res.status).toBe(204);
  });
  it("POST /api/clients seeds one Main campaign", async () => {
    const created = await request(app).post("/api/clients").set(auth).send({ name: "Acme" });
    const res = await request(app).get(`/api/clients/${created.body.id}/campaigns`).set(auth);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe("Main");
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
