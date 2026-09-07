import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { createContainer } from "../../src/composition/create-container.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb } from "../helpers/db.js";
import { createInvite, signInAs } from "../helpers/auth.js";

const container = createContainer();
const app = createApp({ container });

const online = () => container.presence.list().map((person) => person.userId);

beforeEach(async () => {
  await resetDb();
  container.presence.clear();
});
afterAll(async () => { await prisma.$disconnect(); });

describe("who the API counts as online", () => {
  it("marks the caller present when they ask who they are", async () => {
    const { user, auth } = await signInAs("Buyer", { role: "ADMIN" });

    await request(app).get("/api/auth/me").set(auth).expect(200);

    await vi.waitFor(() => { expect(online()).toEqual([user.id]); });
  });

  it("marks the caller present on any authenticated request, not only that one", async () => {
    const { user, auth } = await signInAs("Buyer", { role: "ADMIN" });

    await request(app).get("/api/clients").set(auth).expect(200);

    await vi.waitFor(() => { expect(online()).toEqual([user.id]); });
  });

  it("knows the name and the membership behind an online person", async () => {
    const { user, membership, auth } = await signInAs("Мария", { role: "MANAGER" });

    await request(app).get("/api/auth/me").set(auth).expect(200);

    await vi.waitFor(() => {
      expect(container.presence.list()[0]).toMatchObject({
        userId: user.id,
        membershipId: membership?.id,
        name: "Мария",
        role: "MANAGER",
      });
    });
  });

  it("counts nobody as online for a request without credentials", async () => {
    await request(app).get("/api/auth/me").expect(401);

    expect(online()).toEqual([]);
  });

  it("takes a person out of the roster the moment they sign out", async () => {
    await createInvite("invite-presence");
    const browser = request.agent(app);
    await browser.post("/api/auth/register").send({
      name: "Boris", email: "boris@example.com", password: "hunter2hunter2",
      inviteCode: "invite-presence",
    }).expect(201);
    await browser.get("/api/auth/me").expect(200);
    await vi.waitFor(() => { expect(online()).toHaveLength(1); });

    await browser.post("/api/auth/logout").send({}).expect(204);

    await vi.waitFor(() => { expect(online()).toEqual([]); });
  });
});
