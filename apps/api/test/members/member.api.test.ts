import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { signInAs, signInAsOutsider } from "../helpers/auth.js";

const app = createApp();
const MISSING = "00000000-0000-0000-0000-000000000000";

let admin: { Authorization: string };

beforeEach(async () => {
  await resetDb();
  ({ auth: admin } = await signInAs("Admin", { role: "ADMIN" }));
});
afterAll(async () => { await prisma.$disconnect(); });

describe("GET /api/members", () => {
  it("lists the organization's members with their role and status", async () => {
    await signInAs("Manager", { role: "MANAGER" });
    const res = await request(app).get("/api/members").set(admin);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
    const manager = res.body.find((m: { name: string }) => m.name === "Manager");
    expect(manager).toMatchObject({ role: "MANAGER", status: "ACTIVE" });
    expect(manager.email).toBeTruthy();
  });

  it("never returns a password hash", async () => {
    const res = await request(app).get("/api/members").set(admin);
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");
  });

  it("refuses a manager -> 403", async () => {
    const { auth } = await signInAs("Manager", { role: "MANAGER" });
    expect((await request(app).get("/api/members").set(auth)).status).toBe(403);
  });

  it("refuses a guest -> 403", async () => {
    const { auth } = await signInAs("Guest", { role: "GUEST" });
    expect((await request(app).get("/api/members").set(auth)).status).toBe(403);
  });
});

describe("GET /api/members (payload shape)", () => {
  it("orders members oldest first and carries the identity fields", async () => {
    await signInAs("Second", { role: "MANAGER" });
    const res = await request(app).get("/api/members").set(admin);
    expect(res.body.map((m: { name: string }) => m.name)).toEqual(["Admin", "Second"]);
    expect(res.body[0]).toHaveProperty("image");
    expect(res.body[0]).toHaveProperty("userId");
    expect(res.body[0]).toHaveProperty("createdAt");
  });

  it("never shows a member of another organization", async () => {
    const outsider = await signInAsOutsider();
    const res = await request(app).get("/api/members").set(admin);
    expect(res.body.map((m: { userId: string }) => m.userId)).not.toContain(outsider.user.id);
  });
});

describe("PATCH /api/members/:id (validation and reach)", () => {
  it("refuses a body that changes nothing -> 400", async () => {
    const { membership } = await signInAs("Manager", { role: "MANAGER" });
    const res = await request(app).patch(`/api/members/${membership!.id}`).set(admin).send({});
    expect(res.status).toBe(400);
  });

  it("refuses an unknown status -> 400", async () => {
    const { membership } = await signInAs("Manager", { role: "MANAGER" });
    const res = await request(app).patch(`/api/members/${membership!.id}`)
      .set(admin).send({ status: "ASLEEP" });
    expect(res.status).toBe(400);
  });

  it("answers 404 for a membership in another organization", async () => {
    const outsider = await signInAsOutsider();
    const res = await request(app).patch(`/api/members/${outsider.membership.id}`)
      .set(admin).send({ role: "GUEST" });
    expect(res.status).toBe(404);
  });

  /** The point of resolving the actor per request: a demotion has to bite on
   * the member's very next call. */
  it("takes effect on the demoted member's next request", async () => {
    const manager = await signInAs("Manager", { role: "MANAGER" });
    expect((await request(app).post("/api/clients").set(manager.auth).send({ name: "Mine" })).status).toBe(201);

    await request(app).patch(`/api/members/${manager.membership!.id}`)
      .set(admin).send({ role: "GUEST" });

    const refused = await request(app).post("/api/clients").set(manager.auth).send({ name: "Another" });
    expect(refused.status).toBe(403);
  });

  it("locks a suspended member out on their next request", async () => {
    const manager = await signInAs("Manager", { role: "MANAGER" });
    expect((await request(app).get("/api/clients").set(manager.auth)).status).toBe(200);

    await request(app).patch(`/api/members/${manager.membership!.id}`)
      .set(admin).send({ status: "SUSPENDED" });

    expect((await request(app).get("/api/clients").set(manager.auth)).status).toBe(403);
  });
});

describe("PATCH /api/members/:id", () => {
  it("changes a member's role", async () => {
    const { membership } = await signInAs("Manager", { role: "MANAGER" });
    const res = await request(app).patch(`/api/members/${membership!.id}`)
      .set(admin).send({ role: "GUEST" });

    expect(res.status).toBe(200);
    expect(res.body.role).toBe("GUEST");
    const stored = await prisma.membership.findUniqueOrThrow({ where: { id: membership!.id } });
    expect(stored.role).toBe("GUEST");
  });

  it("suspends and reactivates a member", async () => {
    const { membership } = await signInAs("Manager", { role: "MANAGER" });

    const suspended = await request(app).patch(`/api/members/${membership!.id}`)
      .set(admin).send({ status: "SUSPENDED" });
    expect(suspended.body.status).toBe("SUSPENDED");

    const restored = await request(app).patch(`/api/members/${membership!.id}`)
      .set(admin).send({ status: "ACTIVE" });
    expect(restored.body.status).toBe("ACTIVE");
  });

  it("refuses an unknown role -> 400", async () => {
    const { membership } = await signInAs("Manager", { role: "MANAGER" });
    const res = await request(app).patch(`/api/members/${membership!.id}`)
      .set(admin).send({ role: "OVERLORD" });
    expect(res.status).toBe(400);
  });

  it("answers 404 for a membership that does not exist", async () => {
    const res = await request(app).patch(`/api/members/${MISSING}`).set(admin).send({ role: "GUEST" });
    expect(res.status).toBe(404);
  });

  it("refuses a manager changing anyone's role -> 403", async () => {
    const target = await signInAs("Target", { role: "GUEST" });
    const { auth } = await signInAs("Manager", { role: "MANAGER" });
    const res = await request(app).patch(`/api/members/${target.membership!.id}`)
      .set(auth).send({ role: "ADMIN" });

    expect(res.status).toBe(403);
    const stored = await prisma.membership.findUniqueOrThrow({ where: { id: target.membership!.id } });
    expect(stored.role).toBe("GUEST");
  });

  describe("the last admin", () => {
    it("cannot be demoted -> 409", async () => {
      const only = await prisma.membership.findFirstOrThrow({ where: { role: "ADMIN" } });
      const res = await request(app).patch(`/api/members/${only.id}`)
        .set(admin).send({ role: "MANAGER" });

      expect(res.status).toBe(409);
      const stored = await prisma.membership.findUniqueOrThrow({ where: { id: only.id } });
      expect(stored.role).toBe("ADMIN");
    });

    it("cannot be suspended -> 409", async () => {
      const only = await prisma.membership.findFirstOrThrow({ where: { role: "ADMIN" } });
      const res = await request(app).patch(`/api/members/${only.id}`)
        .set(admin).send({ status: "SUSPENDED" });

      expect(res.status).toBe(409);
      const stored = await prisma.membership.findUniqueOrThrow({ where: { id: only.id } });
      expect(stored.status).toBe("ACTIVE");
    });

    it("can be demoted once a second admin exists", async () => {
      const only = await prisma.membership.findFirstOrThrow({ where: { role: "ADMIN" } });
      await signInAs("Second Admin", { role: "ADMIN" });

      const res = await request(app).patch(`/api/members/${only.id}`)
        .set(admin).send({ role: "MANAGER" });
      expect(res.status).toBe(200);
    });

    it("is not protected by a suspended second admin", async () => {
      const only = await prisma.membership.findFirstOrThrow({ where: { role: "ADMIN" } });
      await signInAs("Dormant", { role: "ADMIN", status: "SUSPENDED" });

      const res = await request(app).patch(`/api/members/${only.id}`)
        .set(admin).send({ role: "MANAGER" });
      expect(res.status).toBe(409);
    });
  });
});

describe("DELETE /api/members/:id", () => {
  it("removes the membership (204)", async () => {
    const { membership } = await signInAs("Manager", { role: "MANAGER" });
    const res = await request(app).delete(`/api/members/${membership!.id}`).set(admin);

    expect(res.status).toBe(204);
    expect(await prisma.membership.findUnique({ where: { id: membership!.id } })).toBeNull();
  });

  it("leaves the removed member's clients and projects standing", async () => {
    const manager = await signInAs("Manager", { role: "MANAGER" });
    const { clientId, projectId } = await seedProject(manager.user.id, "Acme");

    await request(app).delete(`/api/members/${manager.membership!.id}`).set(admin);

    expect(await prisma.client.findUnique({ where: { id: clientId } })).not.toBeNull();
    expect(await prisma.project.findUnique({ where: { id: projectId } })).not.toBeNull();
    expect(await prisma.user.findUnique({ where: { id: manager.user.id } })).not.toBeNull();
  });

  it("locks the removed member out on their next request", async () => {
    const manager = await signInAs("Manager", { role: "MANAGER" });
    expect((await request(app).get("/api/clients").set(manager.auth)).status).toBe(200);

    await request(app).delete(`/api/members/${manager.membership!.id}`).set(admin);
    expect((await request(app).get("/api/clients").set(manager.auth)).status).toBe(403);
  });

  it("refuses to remove the last admin -> 409", async () => {
    const only = await prisma.membership.findFirstOrThrow({ where: { role: "ADMIN" } });
    const res = await request(app).delete(`/api/members/${only.id}`).set(admin);

    expect(res.status).toBe(409);
    expect(await prisma.membership.findUnique({ where: { id: only.id } })).not.toBeNull();
  });

  it("answers 404 for a membership that does not exist", async () => {
    expect((await request(app).delete(`/api/members/${MISSING}`).set(admin)).status).toBe(404);
  });

  it("refuses a manager -> 403", async () => {
    const target = await signInAs("Target", { role: "GUEST" });
    const { auth } = await signInAs("Manager", { role: "MANAGER" });
    expect((await request(app).delete(`/api/members/${target.membership!.id}`).set(auth)).status).toBe(403);
    expect(await prisma.membership.findUnique({ where: { id: target.membership!.id } })).not.toBeNull();
  });
});
