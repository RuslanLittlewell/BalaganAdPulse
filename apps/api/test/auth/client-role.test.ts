import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { grantAccess, signInAs } from "../helpers/auth.js";

const app = createApp();

let customer: { Authorization: string };
let ownClientId: string;
let ownProjectId: string;
let otherClientId: string;
let otherProjectId: string;

beforeEach(async () => {
  await resetDb();
  const admin = await signInAs("Admin", { role: "ADMIN" });
  ({ clientId: ownClientId, projectId: ownProjectId } = await seedProject(admin.user.id, "Theirs"));
  ({ clientId: otherClientId, projectId: otherProjectId } =
    await seedProject(admin.user.id, "Somebody Else"));

  const signedIn = await signInAs("Customer", { role: "CLIENT" });
  customer = signedIn.auth;
  await grantAccess(signedIn.membership!.id, ownClientId);
});
afterAll(async () => { await prisma.$disconnect(); });

describe("a client-role member", () => {
  it("reaches the one client their grant names", async () => {
    const res = await request(app).get("/api/clients").set(customer);
    expect(res.status).toBe(200);
    expect(res.body.map((c: { id: string }) => c.id)).toEqual([ownClientId]);
  });

  it("reads that client and its project", async () => {
    expect((await request(app).get(`/api/clients/${ownClientId}`).set(customer)).status).toBe(200);
    expect((await request(app).get(`/api/projects/${ownProjectId}`).set(customer)).status).toBe(200);
  });

  it("answers 404 for another client in the same organization", async () => {
    expect((await request(app).get(`/api/clients/${otherClientId}`).set(customer)).status).toBe(404);
  });

  it("answers 404 for a project belonging to a different client", async () => {
    expect((await request(app).get(`/api/projects/${otherProjectId}`).set(customer)).status).toBe(404);
  });

  it("lists only their own client's projects", async () => {
    const res = await request(app).get("/api/projects").set(customer);
    expect(res.body.map((p: { id: string }) => p.id)).toEqual([ownProjectId]);
  });

  it("is refused every write, even on the client they reach", async () => {
    const edit = await request(app).patch(`/api/clients/${ownClientId}`)
      .set(customer).send({ name: "Renamed" });
    expect(edit.status).toBe(403);

    const create = await request(app).post("/api/projects")
      .set(customer).send({ clientId: ownClientId, name: "Mine" });
    expect(create.status).toBe(403);
  });

  it("cannot see the member list or the invitations", async () => {
    expect((await request(app).get("/api/members").set(customer)).status).toBe(403);
    expect((await request(app).get("/api/invites").set(customer)).status).toBe(403);
  });

  it("reaches nothing at all without a grant", async () => {
    const ungranted = await signInAs("Ungranted", { role: "CLIENT" });
    const res = await request(app).get("/api/clients").set(ungranted.auth);
    expect(res.body).toEqual([]);
  });
});
