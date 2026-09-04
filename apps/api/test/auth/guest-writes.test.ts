import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedCampaign, seedProject } from "../helpers/db.js";
import { grantAccess, signInAs } from "../helpers/auth.js";

const app = createApp();
const RANGE = "?from=2026-07-01&to=2026-07-31";

let guest: { Authorization: string };
let clientId: string;
let projectId: string;
let campaignId: string;
let taskId: string;

beforeEach(async () => {
  await resetDb();
  const admin = await signInAs("Admin", { role: "ADMIN" });
  ({ clientId, projectId } = await seedProject(admin.user.id));
  campaignId = (await seedCampaign(projectId, "Поиск / Москва")).id;
  const signedIn = await signInAs("Guest", { role: "GUEST" });
  guest = signedIn.auth;
  await grantAccess(signedIn.membership!.id, clientId);

  const task = await request(app).post("/api/tasks").set(admin.auth)
    .send({
      title: "Написать отчёт", projectId, priority: "MEDIUM",
      assigneeId: signedIn.membership!.id,
    });
  taskId = task.body.id;
});
afterAll(async () => { await prisma.$disconnect(); });

describe("a guest reads everything they are granted", () => {
  it("lists and reads the client", async () => {
    expect((await request(app).get("/api/clients").set(guest)).body.length).toBe(1);
    expect((await request(app).get(`/api/clients/${clientId}`).set(guest)).status).toBe(200);
  });

  it("reads the project and the figures beneath it", async () => {
    expect((await request(app).get(`/api/projects/${projectId}`).set(guest)).status).toBe(200);
    expect((await request(app).get(`/api/campaigns/${campaignId}${RANGE}`).set(guest)).status).toBe(200);
    expect((await request(app).get(`/api/projects/${projectId}/summary${RANGE}`).set(guest)).status)
      .toBe(200);
  });
});

describe("a guest is refused every write", () => {
  const refused = (name: string, send: () => request.Test) => {
    it(name, async () => {
      const res = await send();
      expect(res.status).toBe(403);
    });
  };

  refused("creating a client", () =>
    request(app).post("/api/clients").set(guest).send({ name: "New" }));
  refused("editing a client", () =>
    request(app).patch(`/api/clients/${clientId}`).set(guest).send({ name: "Renamed" }));
  refused("deleting a client", () =>
    request(app).delete(`/api/clients/${clientId}`).set(guest));

  refused("creating a project", () =>
    request(app).post("/api/projects").set(guest).send({ clientId, name: "New" }));
  refused("editing a project", () =>
    request(app).patch(`/api/projects/${projectId}`).set(guest).send({ name: "Renamed" }));
  refused("deleting a project", () =>
    request(app).delete(`/api/projects/${projectId}`).set(guest));

  refused("creating a task", () =>
    request(app).post("/api/tasks").set(guest).send({ title: "Новая", projectId, priority: "MEDIUM" }));
  refused("editing a task", () =>
    request(app).patch(`/api/tasks/${taskId}`).set(guest).send({ title: "Другая" }));
  refused("deleting a task", () =>
    request(app).delete(`/api/tasks/${taskId}`).set(guest));

  it("leaves the client standing after a refused delete", async () => {
    await request(app).delete(`/api/clients/${clientId}`).set(guest);
    expect(await prisma.client.findUnique({ where: { id: clientId } })).not.toBeNull();
  });

  it("leaves the task standing after a refused delete", async () => {
    await request(app).delete(`/api/tasks/${taskId}`).set(guest);
    expect(await prisma.task.findUnique({ where: { id: taskId } })).not.toBeNull();
  });
});
