import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { grantAccess, signInAs, signInAsOutsider } from "../helpers/auth.js";

const app = createApp();

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await prisma.$disconnect(); });

/** A client with two projects, entered by somebody else entirely, so nothing a
 * test reaches can be explained by having created it. */
async function someoneElsesClient(name = "Acme") {
  const author = await signInAs(`${name} Author`, { role: "MANAGER" });
  const { clientId, projectId } = await seedProject(author.user.id, name);
  const second = await prisma.project.create({
    data: { clientId, name: `${name} Second`, position: 1 },
  });
  return { clientId, projectId, secondProjectId: second.id };
}

describe("an admin reaches the whole organization", () => {
  it("lists every client, including ones entered by other members", async () => {
    const { clientId } = await someoneElsesClient("Acme");
    const other = await someoneElsesClient("Globex");
    const { auth } = await signInAs("Admin", { role: "ADMIN" });

    const res = await request(app).get("/api/clients").set(auth);
    expect(res.status).toBe(200);
    expect(res.body.map((c: { id: string }) => c.id).sort())
      .toEqual([clientId, other.clientId].sort());
  });

  it("reads a client it holds no grant for", async () => {
    const { clientId } = await someoneElsesClient();
    const { auth } = await signInAs("Admin", { role: "ADMIN" });
    expect((await request(app).get(`/api/clients/${clientId}`).set(auth)).status).toBe(200);
  });

  it("never reaches another organization's client", async () => {
    const outsider = await signInAsOutsider();
    const { auth } = await signInAs("Admin", { role: "ADMIN" });

    const res = await request(app).get(`/api/clients/${outsider.client.id}`).set(auth);
    expect(res.status).toBe(404);
  });

  it("never lists another organization's clients", async () => {
    await signInAsOutsider();
    const { clientId } = await someoneElsesClient();
    const { auth } = await signInAs("Admin", { role: "ADMIN" });

    const res = await request(app).get("/api/clients").set(auth);
    expect(res.body.map((c: { id: string }) => c.id)).toEqual([clientId]);
  });
});

describe("a manager reaches only what a grant names", () => {
  it("lists exactly the granted clients", async () => {
    const granted = await someoneElsesClient("Granted");
    await someoneElsesClient("Ungranted");
    const manager = await signInAs("Manager", { role: "MANAGER" });
    await grantAccess(manager.membership!.id, granted.clientId);

    const res = await request(app).get("/api/clients").set(manager.auth);
    expect(res.body.map((c: { id: string }) => c.id)).toEqual([granted.clientId]);
  });

  it("returns nothing at all without any grant", async () => {
    await someoneElsesClient();
    const manager = await signInAs("Manager", { role: "MANAGER" });

    const res = await request(app).get("/api/clients").set(manager.auth);
    expect(res.body).toEqual([]);
  });

  it("answers 404 for an ungranted client, the same as for a missing one", async () => {
    const { clientId } = await someoneElsesClient();
    const manager = await signInAs("Manager", { role: "MANAGER" });

    const ungranted = await request(app).get(`/api/clients/${clientId}`).set(manager.auth);
    const missing = await request(app)
      .get("/api/clients/00000000-0000-0000-0000-000000000000").set(manager.auth);

    expect(ungranted.status).toBe(404);
    expect(ungranted.status).toBe(missing.status);
    expect(ungranted.body.error.message).toBe(missing.body.error.message);
  });

  it("answers 404 for an ungranted project", async () => {
    const { projectId } = await someoneElsesClient();
    const manager = await signInAs("Manager", { role: "MANAGER" });
    expect((await request(app).get(`/api/projects/${projectId}`).set(manager.auth)).status).toBe(404);
  });

  it("reaches a client once it is granted", async () => {
    const { clientId } = await someoneElsesClient();
    const manager = await signInAs("Manager", { role: "MANAGER" });
    await grantAccess(manager.membership!.id, clientId);

    expect((await request(app).get(`/api/clients/${clientId}`).set(manager.auth)).status).toBe(200);
  });

  it("stops reaching a client when the grant is withdrawn", async () => {
    const { clientId } = await someoneElsesClient();
    const manager = await signInAs("Manager", { role: "MANAGER" });
    await grantAccess(manager.membership!.id, clientId);
    expect((await request(app).get(`/api/clients/${clientId}`).set(manager.auth)).status).toBe(200);

    await prisma.clientAccess.deleteMany({ where: { membershipId: manager.membership!.id } });
    expect((await request(app).get(`/api/clients/${clientId}`).set(manager.auth)).status).toBe(404);
  });
});

describe("a project-scoped grant narrows to that project", () => {
  it("lists only the granted project of the client", async () => {
    const { clientId, projectId } = await someoneElsesClient();
    const manager = await signInAs("Manager", { role: "MANAGER" });
    await grantAccess(manager.membership!.id, clientId, projectId);

    const res = await request(app).get("/api/projects").set(manager.auth);
    expect(res.status).toBe(200);
    expect(res.body.map((p: { id: string }) => p.id)).toEqual([projectId]);
  });

  it("still shows the client the granted project belongs to", async () => {
    const { clientId, projectId } = await someoneElsesClient();
    const manager = await signInAs("Manager", { role: "MANAGER" });
    await grantAccess(manager.membership!.id, clientId, projectId);

    const res = await request(app).get("/api/clients").set(manager.auth);
    expect(res.body.map((c: { id: string }) => c.id)).toEqual([clientId]);
  });

  it("answers 404 for the client's other project", async () => {
    const { clientId, projectId, secondProjectId } = await someoneElsesClient();
    const manager = await signInAs("Manager", { role: "MANAGER" });
    await grantAccess(manager.membership!.id, clientId, projectId);

    expect((await request(app).get(`/api/projects/${secondProjectId}`).set(manager.auth)).status).toBe(404);
    expect((await request(app).get(`/api/projects/${projectId}`).set(manager.auth)).status).toBe(200);
  });

  it("a whole-client grant reaches every project of it", async () => {
    const { clientId, projectId, secondProjectId } = await someoneElsesClient();
    const manager = await signInAs("Manager", { role: "MANAGER" });
    await grantAccess(manager.membership!.id, clientId);

    const res = await request(app).get("/api/projects").set(manager.auth);
    expect(res.body.map((p: { id: string }) => p.id).sort())
      .toEqual([projectId, secondProjectId].sort());
  });
});

describe("reach carries down the hierarchy", () => {
  it("a granted manager reaches the campaigns under the project", async () => {
    const { clientId, projectId } = await someoneElsesClient();
    const campaign = await prisma.campaign.create({
      data: { projectId, name: "Main", position: 0 },
    });
    const manager = await signInAs("Manager", { role: "MANAGER" });
    await grantAccess(manager.membership!.id, clientId);

    expect((await request(app).get(`/api/campaigns/${campaign.id}`).set(manager.auth)).status).toBe(200);
  });

  it("an ungranted manager answers 404 for the same campaign", async () => {
    const { projectId } = await someoneElsesClient();
    const campaign = await prisma.campaign.create({
      data: { projectId, name: "Main", position: 0 },
    });
    const manager = await signInAs("Manager", { role: "MANAGER" });

    expect((await request(app).get(`/api/campaigns/${campaign.id}`).set(manager.auth)).status).toBe(404);
  });
});
