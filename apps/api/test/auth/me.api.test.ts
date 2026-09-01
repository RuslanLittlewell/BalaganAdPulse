import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { currentOrg, signInAs } from "../helpers/auth.js";

const app = createApp();

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await prisma.$disconnect(); });

describe("GET /api/auth/me", () => {
  it("names the caller", async () => {
    const { auth, user } = await signInAs("Buyer");
    const res = await request(app).get("/api/auth/me").set(auth);

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: user.id, name: "Buyer", email: user.email });
  });

  it("never returns the password hash", async () => {
    const { auth } = await signInAs();
    const res = await request(app).get("/api/auth/me").set(auth);
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");
  });

  it("names the organization the caller belongs to", async () => {
    const { auth } = await signInAs();
    const org = await currentOrg();
    const res = await request(app).get("/api/auth/me").set(auth);

    expect(res.body.organization).toMatchObject({ id: org.id, name: org.name, slug: org.slug });
  });

  it("names the caller's role", async () => {
    const { auth } = await signInAs("Guest", { role: "GUEST" });
    const res = await request(app).get("/api/auth/me").set(auth);
    expect(res.body.role).toBe("GUEST");
  });

  it("reports the role as it stands now, not as the token was issued", async () => {
    const { auth, membership } = await signInAs("Boss", { role: "ADMIN" });
    await prisma.membership.update({
      where: { id: membership!.id },
      data: { role: "MANAGER" },
    });
    const res = await request(app).get("/api/auth/me").set(auth);
    expect(res.body.role).toBe("MANAGER");
  });

  it("lists every client of the organization for an admin", async () => {
    const { auth, user } = await signInAs("Admin", { role: "ADMIN" });
    const { clientId } = await seedProject(user.id, "Acme");
    // Another member's client: an admin reaches it too.
    const other = await signInAs("Other", { role: "MANAGER" });
    const second = await seedProject(other.user.id, "Globex");

    const res = await request(app).get("/api/auth/me").set(auth);
    expect([...res.body.clientIds].sort()).toEqual([clientId, second.clientId].sort());
  });

  it("refuses a caller with no membership -> 403", async () => {
    const { auth } = await signInAs("Stranger", { membership: false });
    expect((await request(app).get("/api/auth/me").set(auth)).status).toBe(403);
  });

  it("refuses a suspended membership immediately -> 403", async () => {
    const { auth, membership } = await signInAs("Suspended");
    await prisma.membership.update({ where: { id: membership!.id }, data: { status: "SUSPENDED" } });
    expect((await request(app).get("/api/auth/me").set(auth)).status).toBe(403);
  });

  it("refuses an unauthenticated caller -> 401", async () => {
    expect((await request(app).get("/api/auth/me")).status).toBe(401);
  });
});
