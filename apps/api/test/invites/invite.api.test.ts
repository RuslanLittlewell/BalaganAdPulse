import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { createInvite, signInAs, signInAsOutsider } from "../helpers/auth.js";

const app = createApp();
const MISSING = "00000000-0000-0000-0000-000000000000";

let admin: { Authorization: string };
let projectId: string;

const employee = (overrides: Record<string, unknown> = {}) => ({
  registrationType: "EMPLOYEE", role: "MANAGER", projectIds: [projectId], ...overrides,
});

beforeEach(async () => {
  await resetDb();
  ({ auth: admin } = await signInAs("Admin", { role: "ADMIN" }));
  ({ projectId } = await seedProject("unused", "Invite project"));
});
afterAll(async () => { await prisma.$disconnect(); });

describe("POST /api/invites", () => {
  it("creates an invitation carrying the role it was asked for (201)", async () => {
    const res = await request(app).post("/api/invites").set(admin).send(employee({ role: "GUEST" }));
    expect(res.status).toBe(201);
    expect(res.body.role).toBe("GUEST");
    expect(res.body.code).toBeTruthy();
    expect(res.body.usedAt).toBeNull();
  });

  it("accepts each of the three employee roles", async () => {
    for (const role of ["ADMIN", "MANAGER", "GUEST"]) {
      const res = await request(app).post("/api/invites").set(admin).send(employee({ role }));
      expect(res.status, role).toBe(201);
      expect(res.body.role).toBe(role);
    }
  });

  it("refuses the client role on an employee invitation -> 400", async () => {
    const res = await request(app).post("/api/invites").set(admin).send(employee({ role: "CLIENT" }));
    expect(res.status).toBe(400);
    expect(await prisma.invite.count()).toBe(0);
  });

  it("refuses a role outside the three -> 400", async () => {
    const res = await request(app).post("/api/invites").set(admin).send(employee({ role: "OVERLORD" }));
    expect(res.status).toBe(400);
    expect(await prisma.invite.count()).toBe(0);
  });

  it("refuses an employee invitation with no role at all -> 400", async () => {
    const res = await request(app).post("/api/invites").set(admin)
      .send({ registrationType: "EMPLOYEE", projectIds: [projectId] });
    expect(res.status).toBe(400);
  });

  it("refuses an invitation with no registration type -> 400", async () => {
    const res = await request(app).post("/api/invites").set(admin).send({ role: "MANAGER" });
    expect(res.status).toBe(400);
  });

  it("gives every invitation a different code", async () => {
    const first = await request(app).post("/api/invites").set(admin).send(employee());
    const second = await request(app).post("/api/invites").set(admin).send(employee());
    expect(first.body.code).not.toBe(second.body.code);
  });

  it("records the admin who issued it", async () => {
    const { auth, membership } = await signInAs("Issuer", { role: "ADMIN" });
    const res = await request(app).post("/api/invites").set(auth).send(employee());
    const stored = await prisma.invite.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(stored.createdById).toBe(membership!.id);
  });

  it("stores an expiry when one is asked for", async () => {
    const res = await request(app).post("/api/invites").set(admin)
      .send(employee({ expiresInDays: 7 }));
    expect(res.status).toBe(201);
    expect(new Date(res.body.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("normalises the address it is bound to", async () => {
    const res = await request(app).post("/api/invites").set(admin)
      .send(employee({ email: "  Invited@Acme.COM " }));
    expect(res.body.email).toBe("invited@acme.com");
  });

  it("refuses a manager -> 403", async () => {
    const { auth } = await signInAs("Manager", { role: "MANAGER" });
    const res = await request(app).post("/api/invites").set(auth).send(employee({ role: "GUEST" }));
    expect(res.status).toBe(403);
    expect(await prisma.invite.count()).toBe(0);
  });

  it("refuses a guest -> 403", async () => {
    const { auth } = await signInAs("Guest", { role: "GUEST" });
    const res = await request(app).post("/api/invites").set(auth).send(employee({ role: "GUEST" }));
    expect(res.status).toBe(403);
  });

  it("refuses a client-role member -> 403", async () => {
    const { auth } = await signInAs("Customer", { role: "CLIENT" });
    const res = await request(app).post("/api/invites").set(auth).send(employee({ role: "GUEST" }));
    expect(res.status).toBe(403);
  });

  it("returns the whole invitation, pending and unclaimed", async () => {
    const res = await request(app).post("/api/invites").set(admin).send(employee());
    expect(res.body).toMatchObject({
      role: "MANAGER", email: null, expiresAt: null, revokedAt: null,
      usedAt: null, usedById: null, status: "PENDING",
    });
    expect(res.body.id).toBeTruthy();
    expect(res.body.createdAt).toBeTruthy();
  });

  it("leaves the address null when none is given", async () => {
    const res = await request(app).post("/api/invites").set(admin).send(employee());
    expect(res.body.email).toBeNull();
  });

  it("refuses an address that is not an address -> 400", async () => {
    const res = await request(app).post("/api/invites").set(admin)
      .send(employee({ email: "not-an-address" }));
    expect(res.status).toBe(400);
  });

  it("refuses an expiry of zero days or beyond a year -> 400", async () => {
    for (const expiresInDays of [0, -1, 366, 1.5]) {
      const res = await request(app).post("/api/invites").set(admin)
        .send(employee({ expiresInDays }));
      expect(res.status, String(expiresInDays)).toBe(400);
    }
  });

  it("issues a short code from the unambiguous alphabet", async () => {
    const res = await request(app).post("/api/invites").set(admin).send(employee());
    expect(res.body.code).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/);
    expect(res.body.registrationUrl).toBe(`/regustration/${res.body.code}`);
  });
});

describe("GET /api/invites", () => {
  it("lists the organization's invitations, newest first", async () => {
    await createInvite("older", { role: "MANAGER", projectIds: [projectId] });
    await createInvite("newer", { role: "GUEST", projectIds: [projectId] });
    const res = await request(app).get("/api/invites").set(admin);
    expect(res.status).toBe(200);
    expect(res.body.map((i: { code: string }) => i.code)).toEqual(["newer", "older"]);
  });

  it("returns only the pending ones, leaving the rest stored", async () => {
    await createInvite("pending", { projectIds: [projectId] });
    await createInvite("spent", { usedAt: new Date(), projectIds: [projectId] });
    await createInvite("revoked", { revokedAt: new Date(), projectIds: [projectId] });
    await createInvite("stale", {
      expiresAt: new Date(Date.now() - 60_000), projectIds: [projectId],
    });

    const res = await request(app).get("/api/invites").set(admin);

    expect(res.body.map((i: { code: string }) => i.code)).toEqual(["pending"]);
    expect(res.body[0].status).toBe("PENDING");
    expect(await prisma.invite.count()).toBe(4);
  });

  it("refuses a manager -> 403", async () => {
    const { auth } = await signInAs("Manager", { role: "MANAGER" });
    expect((await request(app).get("/api/invites").set(auth)).status).toBe(403);
  });

  it("never shows another organization's invitations", async () => {
    const outsider = await signInAsOutsider();
    await prisma.invite.create({
      data: { orgId: outsider.org.id, code: "theirs", registrationType: "EMPLOYEE", role: "MANAGER" },
    });
    await createInvite("ours", { projectIds: [projectId] });

    const res = await request(app).get("/api/invites").set(admin);
    expect(res.body.map((i: { code: string }) => i.code)).toEqual(["ours"]);
  });

  it("returns an empty list when nothing has been issued", async () => {
    expect((await request(app).get("/api/invites").set(admin)).body).toEqual([]);
  });
});

describe("DELETE /api/invites/:id", () => {
  it("revokes a pending invitation, and it stops working (204)", async () => {
    const invite = await createInvite("to-revoke");
    const res = await request(app).delete(`/api/invites/${invite.id}`).set(admin);
    expect(res.status).toBe(204);

    const stored = await prisma.invite.findUniqueOrThrow({ where: { id: invite.id } });
    expect(stored.revokedAt).toBeInstanceOf(Date);

    const registration = await request(app).post("/api/auth/register").send({
      name: "Nope", email: "nope@acme.com", password: "hunter2hunter2", inviteCode: "to-revoke",
    });
    expect(registration.status).toBe(403);
  });

  it("refuses to revoke an invitation that was already redeemed -> 409", async () => {
    const invite = await createInvite("already-used", { usedAt: new Date() });
    const res = await request(app).delete(`/api/invites/${invite.id}`).set(admin);
    expect(res.status).toBe(409);

    const stored = await prisma.invite.findUniqueOrThrow({ where: { id: invite.id } });
    expect(stored.usedAt).toBeInstanceOf(Date);
    expect(stored.revokedAt).toBeNull();
  });

  it("answers 404 for an invitation that does not exist", async () => {
    expect((await request(app).delete(`/api/invites/${MISSING}`).set(admin)).status).toBe(404);
  });

  it("revokes an already-revoked invitation without complaint", async () => {
    const invite = await createInvite("twice", { revokedAt: new Date("2026-01-01") });
    expect((await request(app).delete(`/api/invites/${invite.id}`).set(admin)).status).toBe(204);
    const stored = await prisma.invite.findUniqueOrThrow({ where: { id: invite.id } });
    expect(stored.revokedAt).toBeInstanceOf(Date);
  });

  it("never revokes another organization's invitation -> 404", async () => {
    const outsider = await signInAsOutsider();
    const theirs = await prisma.invite.create({
      data: { orgId: outsider.org.id, code: "theirs", role: "MANAGER" },
    });
    expect((await request(app).delete(`/api/invites/${theirs.id}`).set(admin)).status).toBe(404);
    const stored = await prisma.invite.findUniqueOrThrow({ where: { id: theirs.id } });
    expect(stored.revokedAt).toBeNull();
  });

  it("refuses a manager -> 403", async () => {
    const invite = await createInvite("safe");
    const { auth } = await signInAs("Manager", { role: "MANAGER" });
    expect((await request(app).delete(`/api/invites/${invite.id}`).set(auth)).status).toBe(403);
    const stored = await prisma.invite.findUniqueOrThrow({ where: { id: invite.id } });
    expect(stored.revokedAt).toBeNull();
  });
});
