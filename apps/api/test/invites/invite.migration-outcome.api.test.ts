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

describe("a database migrated from untyped invitations", () => {
  const legacy = async () => {
    const org = await currentOrg();
    await prisma.invite.createMany({ data: [
      { orgId: org.id, code: "LEGPENDA", role: "MANAGER" },
      { orgId: org.id, code: "LEGUSEDA", role: "MANAGER", usedAt: new Date() },
      { orgId: org.id, code: "LEGREVKD", role: "GUEST", revokedAt: new Date() },
      { orgId: org.id, code: "LEGEXPRD", role: "ADMIN", expiresAt: new Date(Date.now() - 1) },
    ] });
  };

  it("keeps every legacy row, with its role and timestamps intact", async () => {
    await legacy();

    const stored = await prisma.invite.findMany({ orderBy: { code: "asc" } });

    expect(stored).toHaveLength(4);
    expect(stored.every((invite) => invite.registrationType === "EMPLOYEE")).toBe(true);
    expect(stored.find((invite) => invite.code === "LEGUSEDA")!.usedAt).toBeInstanceOf(Date);
    expect(stored.find((invite) => invite.code === "LEGREVKD")!.revokedAt).toBeInstanceOf(Date);
    expect(stored.find((invite) => invite.code === "LEGEXPRD")!.role).toBe("ADMIN");
  });

  it("offers none of them as actionable, including the pending one", async () => {
    await legacy();

    const response = await request(app).get("/api/invites").set(admin);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it("leaves a legacy link resolving and redeemable, though it grants nothing", async () => {
    await legacy();

    const resolved = await request(app).get("/api/regustration/LEGPENDA");
    expect(resolved.status).toBe(200);
    expect(resolved.body).toEqual({ registrationType: "EMPLOYEE" });

    const registered = await request(app).post("/api/auth/register").send({
      name: "Legacy", email: "legacy@acme.com", password: "hunter2hunter2",
      inviteCode: "LEGPENDA",
    });
    expect(registered.status).toBe(201);

    const membership = await prisma.membership.findFirstOrThrow({
      where: { user: { email: "legacy@acme.com" } },
    });
    expect(membership.role).toBe("MANAGER");
    expect(await prisma.clientAccess.count({ where: { membershipId: membership.id } })).toBe(0);
  });

  it("stops resolving once the legacy row is revoked", async () => {
    await legacy();
    const pending = await prisma.invite.findFirstOrThrow({ where: { code: "LEGPENDA" } });

    await request(app).delete(`/api/invites/${pending.id}`).set(admin);

    expect((await request(app).get("/api/regustration/LEGPENDA")).status).toBe(404);
  });

  it("still lists invitations issued after the deploy", async () => {
    await legacy();
    const created = await request(app).post("/api/invites").set(admin).send({
      registrationType: "EMPLOYEE", role: "MANAGER", projectIds: [projectId],
    });

    const response = await request(app).get("/api/invites").set(admin);

    expect(response.body.map((invite: { id: string }) => invite.id)).toEqual([created.body.id]);
  });

  it("becomes actionable again once a project is attached", async () => {
    await legacy();
    const pending = await prisma.invite.findFirstOrThrow({ where: { code: "LEGPENDA" } });
    await prisma.inviteProject.create({ data: { inviteId: pending.id, projectId } });

    const response = await request(app).get("/api/invites").set(admin);

    expect(response.body.map((invite: { code: string }) => invite.code)).toEqual(["LEGPENDA"]);
  });
});
