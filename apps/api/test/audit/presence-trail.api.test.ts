import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { createContainer } from "../../src/composition/create-container.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb } from "../helpers/db.js";
import { createInvite, signInAs } from "../helpers/auth.js";

const container = createContainer();
const app = createApp({ container });

const presenceOf = (membershipId: string) => prisma.auditEvent.findMany({
  where: { actorId: membershipId, action: { in: ["ONLINE", "OFFLINE"] } },
  orderBy: { createdAt: "asc" },
});

beforeEach(async () => {
  await resetDb();
  container.presence.clear();
});
afterAll(async () => { await prisma.$disconnect(); });

describe("coming online and going offline in the trail", () => {
  it("records a member coming online once, with them as actor and entity", async () => {
    const { membership, auth } = await signInAs("Мария", { role: "MANAGER" });

    await request(app).get("/api/auth/me").set(auth).expect(200);
    await request(app).get("/api/auth/me").set(auth).expect(200);

    await vi.waitFor(async () => expect(await presenceOf(membership!.id)).toHaveLength(1));
    expect((await presenceOf(membership!.id))[0]).toMatchObject({
      action: "ONLINE", entityType: "member", entityId: membership!.id, actorName: "Мария",
      clientId: null, projectId: null, campaignId: null,
    });
  });

  it("records a sign-out as going offline", async () => {
    await createInvite("invite-trail");
    const browser = request.agent(app);
    await browser.post("/api/auth/register").send({
      name: "Boris", email: "boris@example.com", password: "hunter2hunter2", inviteCode: "invite-trail",
    }).expect(201);
    await browser.get("/api/auth/me").expect(200);
    const membership = await prisma.membership.findFirstOrThrow({ where: { user: { email: "boris@example.com" } } });
    await vi.waitFor(async () => expect(await presenceOf(membership.id)).toHaveLength(1));

    await browser.post("/api/auth/logout").send({}).expect(204);

    await vi.waitFor(async () => {
      expect((await presenceOf(membership.id)).map((event) => event.action)).toEqual(["ONLINE", "OFFLINE"]);
    });
  });

  it("is read by admins, and not by managers", async () => {
    const admin = await signInAs("Admin", { role: "ADMIN" });
    const manager = await signInAs("Мария", { role: "MANAGER" });
    await request(app).get("/api/auth/me").set(manager.auth).expect(200);
    await vi.waitFor(async () => expect(await presenceOf(manager.membership!.id)).toHaveLength(1));

    const own = await request(app).get("/api/audit").set(manager.auth).expect(200);
    const all = await request(app).get("/api/audit").query({ actorId: manager.membership!.id }).set(admin.auth).expect(200);

    expect(own.body.items).toEqual([]);
    expect(all.body.items.map((event: { action: string }) => event.action)).toEqual(["ONLINE"]);
  });
});
