import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { grantAccess, signInAs, signInAsOutsider } from "../helpers/auth.js";

const app = createApp();
const MISSING = "00000000-0000-0000-0000-000000000000";

let admin: { Authorization: string };
let manager: Awaited<ReturnType<typeof signInAs>>;
let acmeId: string;
let acmeProjectId: string;
let globexId: string;

beforeEach(async () => {
  await resetDb();
  const signedInAdmin = await signInAs("Admin", { role: "ADMIN" });
  admin = signedInAdmin.auth;
  ({ clientId: acmeId, projectId: acmeProjectId } = await seedProject(signedInAdmin.user.id, "Acme"));
  ({ clientId: globexId } = await seedProject(signedInAdmin.user.id, "Globex"));
  manager = await signInAs("Manager", { role: "MANAGER" });
});
afterAll(async () => { await prisma.$disconnect(); });

function setAccess(membershipId: string, grants: unknown, auth = admin) {
  return request(app).put(`/api/members/${membershipId}/access`).set(auth).send({ grants });
}

describe("PUT /api/members/:id/access", () => {
  it("grants a member a whole client, and they can then reach it", async () => {
    const res = await setAccess(manager.membership!.id, [{ clientId: acmeId }]);
    expect(res.status).toBe(200);

    const clients = await request(app).get("/api/clients").set(manager.auth);
    expect(clients.body.map((c: { id: string }) => c.id)).toEqual([acmeId]);
  });

  it("replaces the whole set rather than adding to it", async () => {
    await grantAccess(manager.membership!.id, globexId);
    await setAccess(manager.membership!.id, [{ clientId: acmeId }]);

    const clients = await request(app).get("/api/clients").set(manager.auth);
    expect(clients.body.map((c: { id: string }) => c.id)).toEqual([acmeId]);
  });

  it("withdraws every grant when given an empty list", async () => {
    await grantAccess(manager.membership!.id, acmeId);
    const res = await setAccess(manager.membership!.id, []);

    expect(res.status).toBe(200);
    expect((await request(app).get("/api/clients").set(manager.auth)).body).toEqual([]);
  });

  it("grants one project of a client", async () => {
    await setAccess(manager.membership!.id, [{ clientId: acmeId, projectId: acmeProjectId }]);

    const projects = await request(app).get("/api/projects").set(manager.auth);
    expect(projects.body.map((p: { id: string }) => p.id)).toEqual([acmeProjectId]);
  });

  it("refuses a project that belongs to a different client -> 400", async () => {
    const res = await setAccess(manager.membership!.id,
      [{ clientId: globexId, projectId: acmeProjectId }]);
    expect(res.status).toBe(400);
    expect(await prisma.clientAccess.count({ where: { membershipId: manager.membership!.id } })).toBe(0);
  });

  it("refuses a client from another organization -> 400", async () => {
    const outsider = await signInAsOutsider();
    const res = await setAccess(manager.membership!.id, [{ clientId: outsider.client.id }]);
    expect(res.status).toBe(400);
  });

  it("refuses a client that does not exist -> 400", async () => {
    const res = await setAccess(manager.membership!.id, [{ clientId: MISSING }]);
    expect(res.status).toBe(400);
  });

  it("refuses two identical whole-client grants -> 400", async () => {
    const res = await setAccess(manager.membership!.id, [{ clientId: acmeId }, { clientId: acmeId }]);
    expect(res.status).toBe(400);
  });

  it("answers 404 for a membership in another organization", async () => {
    const outsider = await signInAsOutsider();
    const res = await setAccess(outsider.membership.id, [{ clientId: acmeId }]);
    expect(res.status).toBe(404);
  });

  it("answers 404 for a membership that does not exist", async () => {
    expect((await setAccess(MISSING, [])).status).toBe(404);
  });

  it("refuses a manager -> 403", async () => {
    const res = await setAccess(manager.membership!.id, [{ clientId: acmeId }], manager.auth);
    expect(res.status).toBe(403);
    expect(await prisma.clientAccess.count()).toBe(0);
  });

  it("leaves the previous grants untouched when the new set is rejected", async () => {
    await setAccess(manager.membership!.id, [{ clientId: acmeId }]);
    await setAccess(manager.membership!.id, [{ clientId: MISSING }]);

    const clients = await request(app).get("/api/clients").set(manager.auth);
    expect(clients.body.map((c: { id: string }) => c.id)).toEqual([acmeId]);
  });
});

describe("GET /api/members/:id/access", () => {
  it("returns every grant the membership holds", async () => {
    const manager = await signInAs("Менеджер", { role: "MANAGER" });
    const { clientId, projectId } = await seedProject("unused", "Acme");
    await request(app).put(`/api/members/${manager.membership!.id}/access`).set(admin)
      .send({ grants: [{ clientId, projectId }] });

    const res = await request(app).get(`/api/members/${manager.membership!.id}/access`).set(admin);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([expect.objectContaining({ clientId, projectId })]);
  });

  it("returns an empty list for somebody holding none", async () => {
    const manager = await signInAs("Менеджер", { role: "MANAGER" });

    const res = await request(app).get(`/api/members/${manager.membership!.id}/access`).set(admin);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns a client-wide grant as such", async () => {
    const manager = await signInAs("Менеджер", { role: "MANAGER" });
    const { clientId } = await seedProject("unused", "Acme");
    await request(app).put(`/api/members/${manager.membership!.id}/access`).set(admin)
      .send({ grants: [{ clientId }] });

    const res = await request(app).get(`/api/members/${manager.membership!.id}/access`).set(admin);

    expect(res.body).toEqual([expect.objectContaining({ clientId, projectId: null })]);
  });

  it("refuses somebody who may not administer members", async () => {
    const manager = await signInAs("Менеджер", { role: "MANAGER" });

    expect((await request(app).get(`/api/members/${manager.membership!.id}/access`)
      .set(manager.auth)).status).toBe(403);
  });

  it("404s a membership in another organization", async () => {
    const outsider = await signInAsOutsider();

    expect((await request(app).get(`/api/members/${outsider.membership.id}/access`)
      .set(admin)).status).toBe(404);
  });
});
