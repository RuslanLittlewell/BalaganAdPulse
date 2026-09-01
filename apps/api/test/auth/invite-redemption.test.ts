import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/composition/app.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb } from "../helpers/db.js";
import { createInvite } from "../helpers/auth.js";
import { resetIdentityRateLimits } from "../../src/modules/identity/presentation/http/identity-http.js";

const app = createApp();

const account = { name: "Newcomer", email: "newcomer@acme.com", password: "hunter2hunter2" };

/** Every refusal is supposed to look the same, so the assertions compare
 * against one constant rather than against whatever each branch happens to say. */
const REFUSED = { status: 403, message: "Invalid invite code" };

function register(body: Record<string, unknown>) {
  return request(app).post("/api/auth/register").send(body);
}

beforeEach(async () => { await resetDb(); resetIdentityRateLimits(); });
afterAll(async () => { await prisma.$disconnect(); });

describe("redeeming an invitation", () => {
  it("gives the new member the role the invitation names", async () => {
    await createInvite("code-manager", { role: "MANAGER" });
    const res = await register({ ...account, inviteCode: "code-manager" });

    expect(res.status).toBe(201);
    const membership = await prisma.membership.findFirstOrThrow({
      where: { user: { email: account.email } },
    });
    expect(membership.role).toBe("MANAGER");
    expect(membership.status).toBe("ACTIVE");
  });

  it("gives a guest invitation the guest role, not the staff default", async () => {
    await createInvite("code-guest", { role: "GUEST" });
    await register({ ...account, inviteCode: "code-guest" });

    const membership = await prisma.membership.findFirstOrThrow({
      where: { user: { email: account.email } },
    });
    expect(membership.role).toBe("GUEST");
  });

  it("ignores a role the registrant asks for themselves", async () => {
    await createInvite("code-manager", { role: "MANAGER" });
    await register({ ...account, inviteCode: "code-manager", role: "ADMIN" });

    const membership = await prisma.membership.findFirstOrThrow({
      where: { user: { email: account.email } },
    });
    expect(membership.role).toBe("MANAGER");
  });

  it("records who redeemed the invitation, and when", async () => {
    await createInvite("code-manager");
    await register({ ...account, inviteCode: "code-manager" });

    const invite = await prisma.invite.findUniqueOrThrow({ where: { code: "code-manager" } });
    const user = await prisma.user.findUniqueOrThrow({ where: { email: account.email } });
    expect(invite.usedById).toBe(user.id);
    expect(invite.usedAt).toBeInstanceOf(Date);
  });

  it("lets the new member work on their very first request", async () => {
    await createInvite("code-manager", { role: "MANAGER" });
    const res = await register({ ...account, inviteCode: "code-manager" });

    const clients = await request(app).get("/api/clients")
      .set("Authorization", `Bearer ${res.body.accessToken}`);
    expect(clients.status).toBe(200);
  });

  it("refuses a registration with no invitation code -> 400", async () => {
    const res = await register(account);
    expect(res.status).toBe(400);
    expect(await prisma.user.count()).toBe(0);
  });

  it("refuses an unknown code", async () => {
    const res = await register({ ...account, inviteCode: "no-such-code" });
    expect(res.status).toBe(REFUSED.status);
    expect(res.body.error.message).toBe(REFUSED.message);
    expect(await prisma.user.count()).toBe(0);
  });

  it("refuses an expired invitation", async () => {
    await createInvite("code-expired", { expiresAt: new Date(Date.now() - 60_000) });
    const res = await register({ ...account, inviteCode: "code-expired" });
    expect(res.status).toBe(REFUSED.status);
    expect(res.body.error.message).toBe(REFUSED.message);
    expect(await prisma.user.count()).toBe(0);
  });

  it("accepts an invitation whose expiry is still ahead", async () => {
    await createInvite("code-fresh", { expiresAt: new Date(Date.now() + 60_000) });
    const res = await register({ ...account, inviteCode: "code-fresh" });
    expect(res.status).toBe(201);
  });

  it("refuses a revoked invitation", async () => {
    await createInvite("code-revoked", { revokedAt: new Date() });
    const res = await register({ ...account, inviteCode: "code-revoked" });
    expect(res.status).toBe(REFUSED.status);
    expect(res.body.error.message).toBe(REFUSED.message);
    expect(await prisma.user.count()).toBe(0);
  });

  it("refuses a code that has already been redeemed", async () => {
    await createInvite("code-once");
    expect((await register({ ...account, inviteCode: "code-once" })).status).toBe(201);

    const second = await register({
      ...account, email: "second@acme.com", inviteCode: "code-once",
    });
    expect(second.status).toBe(REFUSED.status);
    expect(second.body.error.message).toBe(REFUSED.message);
    expect(await prisma.user.count()).toBe(1);
  });

  it("refuses an address-bound invitation redeemed from another address", async () => {
    await createInvite("code-bound", { email: "invited@acme.com" });
    const res = await register({ ...account, email: "someone.else@acme.com", inviteCode: "code-bound" });
    expect(res.status).toBe(REFUSED.status);
    expect(res.body.error.message).toBe(REFUSED.message);
    expect(await prisma.user.count()).toBe(0);
  });

  it("accepts an address-bound invitation from the address it names", async () => {
    await createInvite("code-bound", { email: "invited@acme.com" });
    const res = await register({ ...account, email: "invited@acme.com", inviteCode: "code-bound" });
    expect(res.status).toBe(201);
  });

  /** The account and the membership are created together or not at all: a user
   * row with no membership is refused by loadActor on every request, so a
   * half-finished registration would produce an account that can never be used. */
  it("leaves the invitation unredeemed when the registration fails", async () => {
    await createInvite("code-manager");
    await register({ ...account, inviteCode: "code-manager" });

    await createInvite("code-second");
    const duplicate = await register({ ...account, inviteCode: "code-second" });

    expect(duplicate.status).toBe(409);
    const second = await prisma.invite.findUniqueOrThrow({ where: { code: "code-second" } });
    expect(second.usedAt).toBeNull();
    expect(second.usedById).toBeNull();
  });

  it("never leaves an account without a membership", async () => {
    await createInvite("code-manager");
    await register({ ...account, inviteCode: "code-manager" });

    const users = await prisma.user.findMany({ include: { memberships: true } });
    for (const user of users) expect(user.memberships.length).toBe(1);
  });
});
