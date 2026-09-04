import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { currentOrg, signInAs } from "../helpers/auth.js";

const app = createApp();
let admin: { Authorization: string };
let projectId: string;

beforeEach(async () => {
  await resetDb();
  ({ auth: admin } = await signInAs("Admin", { role: "ADMIN" }));
  ({ projectId } = await seedProject("unused", "Invite project"));
});

afterAll(async () => { await prisma.$disconnect(); });

describe("typed invitation HTTP contracts", () => {
  it("creates client and employee invitations with backend registration URLs", async () => {
    const client = await request(app).post("/api/invites").set(admin).send({
      registrationType: "CLIENT",
    });
    expect(client.status).toBe(201);
    expect(client.body).toMatchObject({ registrationType: "CLIENT", role: null, projectIds: [] });
    expect(client.body.code).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/);
    expect(client.body.registrationUrl).toBe(`/regustration/${client.body.code}`);

    const employee = await request(app).post("/api/invites").set(admin).send({
      registrationType: "EMPLOYEE",
      role: "MANAGER",
      projectIds: [projectId],
    });
    expect(employee.status).toBe(201);
    expect(employee.body).toMatchObject({
      registrationType: "EMPLOYEE", role: "MANAGER", projectIds: [projectId],
    });
  });

  it("validates fields according to registration type", async () => {
    expect((await request(app).post("/api/invites").set(admin).send({
      registrationType: "CLIENT", role: "GUEST",
    })).status).toBe(400);
    expect((await request(app).post("/api/invites").set(admin).send({
      registrationType: "EMPLOYEE", role: "GUEST", projectIds: [],
    })).status).toBe(400);
  });

  it("lists only pending invitations and filters by registration type", async () => {
    const org = await currentOrg();
    await prisma.invite.createMany({ data: [
      { orgId: org.id, code: "CLENTABC", registrationType: "CLIENT", role: null },
      { orgId: org.id, code: "REVOKEDA", registrationType: "CLIENT", role: null, revokedAt: new Date() },
      { orgId: org.id, code: "USEDABCD", registrationType: "CLIENT", role: null, usedAt: new Date() },
      { orgId: org.id, code: "EXPRDABC", registrationType: "CLIENT", role: null, expiresAt: new Date(Date.now() - 1) },
    ] });

    const response = await request(app).get("/api/invites?registrationType=CLIENT").set(admin);
    expect(response.status).toBe(200);
    expect(response.body.map((invite: { code: string }) => invite.code)).toEqual(["CLENTABC"]);
    expect(await prisma.invite.count({ where: { orgId: org.id } })).toBe(4);
  });
});

describe("GET /api/regustration/:code", () => {
  it("is public and returns registration type only", async () => {
    const org = await currentOrg();
    await prisma.invite.create({
      data: { orgId: org.id, code: "PUBLCAAB", registrationType: "CLIENT", role: null },
    });
    const response = await request(app).get("/api/regustration/PUBLCAAB");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ registrationType: "CLIENT" });
  });

  it.each([
    ["unknown", "ZZYYXXWW", {}],
    ["revoked", "REVKEDAB", { revokedAt: new Date() }],
    ["used", "USEDABCD", { usedAt: new Date() }],
    ["expired", "EXPRDABC", { expiresAt: new Date(Date.now() - 1) }],
  ])("returns one response for %s codes", async (_label, code, lifecycle) => {
    if (_label !== "unknown") {
      await prisma.invite.create({
        data: {
          orgId: (await currentOrg()).id,
          code,
          registrationType: "CLIENT",
          role: null,
          ...lifecycle,
        },
      });
    }
    const response = await request(app).get(`/api/regustration/${code}`);
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: { message: "Invalid invite code" } });
  });

  // Its own case, so the lifecycle rows above keep testing lifecycle: a code
  // outside the alphabet can never exist, and saying so would separate it from
  // a code that merely does not exist.
  it.each([
    ["the wrong length", "SHORT"],
    ["a character outside the alphabet", "REVOKEDA"],
    ["lowercase", "abcdefgh"],
  ])("returns the same response for a code with %s", async (_label, code) => {
    const response = await request(app).get(`/api/regustration/${code}`);
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: { message: "Invalid invite code" } });
  });

  it("rate limits repeated public lookups", async () => {
    let status = 0;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      status = (await request(app).get("/api/regustration/PRBEABCD")).status;
      if (status === 429) break;
    }
    expect(status).toBe(429);
  });
});

describe("inviting somebody to an existing client, over HTTP", () => {
  it("creates one against the client it names", async () => {
    const client = await prisma.client.create({
      data: { name: "Клиника", orgId: (await currentOrg()).id },
    });

    const created = await request(app).post("/api/invites").set(admin)
      .send({ registrationType: "CLIENT_STAFF", clientId: client.id });

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      registrationType: "CLIENT_STAFF", clientId: client.id, role: null, projectIds: [],
    });
  });

  it("400s one that names no client", async () => {
    expect((await request(app).post("/api/invites").set(admin)
      .send({ registrationType: "CLIENT_STAFF" })).status).toBe(400);
  });

  it("400s a role or projects on it", async () => {
    const client = await prisma.client.create({
      data: { name: "Клиника", orgId: (await currentOrg()).id },
    });

    expect((await request(app).post("/api/invites").set(admin).send({
      registrationType: "CLIENT_STAFF", clientId: client.id, role: "MANAGER",
    })).status).toBe(400);
  });

  it("400s a client named on the other two kinds", async () => {
    const client = await prisma.client.create({
      data: { name: "Клиника", orgId: (await currentOrg()).id },
    });

    expect((await request(app).post("/api/invites").set(admin).send({
      registrationType: "CLIENT", clientId: client.id,
    })).status).toBe(400);
  });

  it("joins the client when it is redeemed", async () => {
    const client = await prisma.client.create({
      data: { name: "Клиника", orgId: (await currentOrg()).id },
    });
    const project = await prisma.project.create({
      data: { clientId: client.id, name: "Стоматология", position: 0 },
    });
    const created = await request(app).post("/api/invites").set(admin)
      .send({ registrationType: "CLIENT_STAFF", clientId: client.id });

    const registered = await request(app).post("/api/auth/register").send({
      name: "Мария", email: "maria@clinic.by", password: "hunter2hunter2",
      inviteCode: created.body.code,
    });

    expect(registered.status).toBe(201);
    const user = await prisma.user.findFirstOrThrow({ where: { email: "maria@clinic.by" } });
    const membership = await prisma.membership.findFirstOrThrow({ where: { userId: user.id } });
    expect(membership.role).toBe("CLIENT");
    const grants = await prisma.clientAccess.findMany({ where: { membershipId: membership.id } });
    expect(grants.map((grant) => grant.projectId)).toEqual([project.id]);
  });
});
