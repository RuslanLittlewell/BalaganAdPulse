import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { resetDb } from "../helpers/db.js";
import { prisma } from "../../src/lib/prisma.js";

const app = createApp();
const MISSING = "00000000-0000-0000-0000-000000000000";

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await prisma.$disconnect(); });

describe("Clients API", () => {
  it("POST /api/clients creates (201)", async () => {
    const res = await request(app).post("/api/clients").send({ name: "Acme" });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Acme");
  });
  it("POST /api/clients with empty name -> 400", async () => {
    const res = await request(app).post("/api/clients").send({ name: "" });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBeTruthy();
  });
  it("GET /api/clients returns the list (200)", async () => {
    await request(app).post("/api/clients").send({ name: "A" });
    const res = await request(app).get("/api/clients");
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });
  it("GET /api/clients/:id for a missing id -> 404", async () => {
    const res = await request(app).get(`/api/clients/${MISSING}`);
    expect(res.status).toBe(404);
  });
  it("PATCH /api/clients/:id updates (200)", async () => {
    const c = await request(app).post("/api/clients").send({ name: "A" });
    const res = await request(app).patch(`/api/clients/${c.body.id}`).send({ niche: "fitness" });
    expect(res.status).toBe(200);
    expect(res.body.niche).toBe("fitness");
  });
  it("DELETE /api/clients/:id deletes (204)", async () => {
    const c = await request(app).post("/api/clients").send({ name: "A" });
    const res = await request(app).delete(`/api/clients/${c.body.id}`);
    expect(res.status).toBe(204);
  });
});
