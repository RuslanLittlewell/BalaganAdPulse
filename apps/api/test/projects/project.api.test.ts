import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { resetDb } from "../helpers/db.js";
import { prisma } from "../../src/lib/prisma.js";
import { signInAs } from "../helpers/auth.js";

const app = createApp();
const MISSING = "00000000-0000-0000-0000-000000000000";

let auth: { Authorization: string };
let clientId: string;

async function project(body: Record<string, unknown> = {}) {
  return request(app).post("/api/projects").set(auth)
    .send({ clientId, name: "Летний запуск", ...body });
}

beforeEach(async () => {
  await resetDb();
  ({ auth } = await signInAs());
  const client = await request(app).post("/api/clients").set(auth).send({ name: "Acme" });
  clientId = client.body.id;
});
afterAll(async () => { await prisma.$disconnect(); });

describe("Projects API", () => {
  it("creates a project bound to a client (201)", async () => {
    const res = await project({ niche: "fitness", monthlyBudget: 1500 });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ clientId, name: "Летний запуск", niche: "fitness" });
    expect(res.body.monthlyBudget).toBe("1500");
  });

  it("keeps the budget exact, as a decimal rather than a float", async () => {
    const res = await project({ monthlyBudget: 1234.56 });
    const stored = await prisma.project.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(String(stored.monthlyBudget)).toBe("1234.56");
  });

  it("refuses a project without a client", async () => {
    const res = await request(app).post("/api/projects").set(auth).send({ name: "Без клиента" });
    expect(res.status).toBe(400);
  });

  it("refuses a project on a client the caller does not own", async () => {
    const res = await project({ clientId: MISSING });
    expect(res.status).toBe(404);
  });

  it("seeds one Main sheet, so the project is usable straight away", async () => {
    const created = await project();
    const res = await request(app).get(`/api/projects/${created.body.id}/campaigns`).set(auth);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe("Main");
  });

  it("creating a client alone seeds nothing: work starts with a project", async () => {
    const client = await request(app).post("/api/clients").set(auth).send({ name: "Bare" });
    const projects = await request(app)
      .get(`/api/projects?clientId=${client.body.id}`).set(auth);

    expect(projects.body).toHaveLength(0);
  });

  it("lists every project, and narrows to one client on request", async () => {
    await project({ name: "A" });
    const second = await request(app).post("/api/clients").set(auth).send({ name: "Other" });
    await request(app).post("/api/projects").set(auth)
      .send({ clientId: second.body.id, name: "B" });

    const all = await request(app).get("/api/projects").set(auth);
    const narrowed = await request(app).get(`/api/projects?clientId=${clientId}`).set(auth);

    expect(all.body).toHaveLength(2);
    expect(narrowed.body.map((p: { name: string }) => p.name)).toEqual(["A"]);
  });

  it("numbers a client's projects in the order they were added", async () => {
    const first = await project({ name: "A" });
    const second = await project({ name: "B" });
    expect(first.body.position).toBe(0);
    expect(second.body.position).toBe(1);
  });

  it("updates a project", async () => {
    const created = await project();
    const res = await request(app).patch(`/api/projects/${created.body.id}`).set(auth)
      .send({ name: "Осенний запуск", niche: "beauty" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: "Осенний запуск", niche: "beauty" });
  });

  it("deletes a project and its sheets", async () => {
    const created = await project();
    const res = await request(app).delete(`/api/projects/${created.body.id}`).set(auth);

    expect(res.status).toBe(204);
    expect(await prisma.campaign.count({ where: { projectId: created.body.id } })).toBe(0);
  });

  it("hides another owner's project behind the same 404", async () => {
    const other = await signInAs("Other");
    const theirClient = await request(app).post("/api/clients").set(other.auth).send({ name: "T" });
    const theirs = await request(app).post("/api/projects").set(other.auth)
      .send({ clientId: theirClient.body.id, name: "Theirs" });

    const res = await request(app).get(`/api/projects/${theirs.body.id}`).set(auth);
    expect(res.status).toBe(404);
  });

  it("hands the logo back inside the project, in the list and on its own", async () => {
    const PNG = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    const created = await project();
    const put = await request(app).put(`/api/projects/${created.body.id}/avatar`).set(auth)
      .field("avatarPath", JSON.stringify({ source: "upload" }))
      .attach("image", PNG, { filename: "logo.png", contentType: "image/png" });

    expect(put.status).toBe(200);
    expect(put.body.image).toMatch(/^data:image\/png;base64,/);

    const one = await request(app).get(`/api/projects/${created.body.id}`).set(auth);
    const list = await request(app).get("/api/projects").set(auth);
    expect(one.body.image).toMatch(/^data:image\/png;base64,/);
    expect(list.body[0].image).toMatch(/^data:image\/png;base64,/);
  });

  it("reports no logo before one is uploaded", async () => {
    const created = await project();
    expect(created.body.image).toBeNull();
  });

  it("answers 404 for the avatar endpoint that no longer exists", async () => {
    const created = await project();
    const res = await request(app).get(`/api/projects/${created.body.id}/avatar`).set(auth);
    expect(res.status).toBe(404);
  });

  it("starts a project at NEW, so a fresh one is marked as such", async () => {
    const res = await project();
    expect(res.body.priority).toBe("NEW");
  });

  it("takes a priority on creation", async () => {
    const res = await project({ priority: "CRITICAL" });
    expect(res.status).toBe(201);
    expect(res.body.priority).toBe("CRITICAL");
  });

  it("changes the priority on its own, without touching the rest", async () => {
    const created = await project({ niche: "fitness", monthlyBudget: 1500 });
    const res = await request(app).patch(`/api/projects/${created.body.id}`).set(auth)
      .send({ priority: "URGENT" });

    expect(res.status).toBe(200);
    expect(res.body.priority).toBe("URGENT");
    expect(res.body).toMatchObject({ niche: "fitness", name: "Летний запуск" });
  });

  it("accepts every priority the interface offers", async () => {
    for (const priority of ["CRITICAL", "URGENT", "WAITING", "IDLE", "NEW"]) {
      const created = await project({ priority });
      expect(created.body.priority, priority).toBe(priority);
    }
  });

  it("refuses a priority it does not know", async () => {
    const res = await project({ priority: "MAGENTA" });
    expect(res.status).toBe(400);
  });

  it("carries the priority in the list", async () => {
    await project({ priority: "WAITING" });
    const res = await request(app).get("/api/projects").set(auth);
    expect(res.body[0].priority).toBe("WAITING");
  });
});
