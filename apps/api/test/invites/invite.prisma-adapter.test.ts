import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Prisma } from "@prisma/client";
import { PrismaInviteRepository } from "../../src/modules/invites/infrastructure/prisma-invite-repository.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { PrismaUnitOfWork } from "../../src/shared/infrastructure/prisma-unit-of-work.js";
import { resetDb } from "../helpers/db.js";
import { currentOrg, signInAs, signInAsOutsider } from "../helpers/auth.js";

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

function repository() {
  const unitOfWork = new PrismaUnitOfWork<Prisma.TransactionClient>(prisma);
  return { unitOfWork, invites: new PrismaInviteRepository(prisma, unitOfWork) };
}

const NOW = new Date("2026-09-01T12:00:00.000Z");

describe("Prisma invite repository", () => {
  it("stores an invitation and reads it back whole", async () => {
    const { unitOfWork, invites } = repository();
    const org = await currentOrg();
    const created = await unitOfWork.run((context) =>
      invites.create(context, {
        id: "11111111-1111-1111-1111-111111111111",
        orgId: org.id, code: "the-code", role: "GUEST",
        email: "invited@acme.com", expiresAt: NOW, createdById: null,
      }),
    );
    expect(created).toMatchObject({
      id: "11111111-1111-1111-1111-111111111111", orgId: org.id, code: "the-code",
      role: "GUEST", email: "invited@acme.com", usedAt: null, revokedAt: null,
    });
    expect(created.expiresAt?.toISOString()).toBe(NOW.toISOString());
  });

  it("records the membership that issued it", async () => {
    const { unitOfWork, invites } = repository();
    const admin = await signInAs("Admin", { role: "ADMIN" });
    const created = await unitOfWork.run((context) =>
      invites.create(context, {
        id: "22222222-2222-2222-2222-222222222222",
        orgId: admin.membership!.orgId, code: "issued", role: "MANAGER",
        email: null, expiresAt: null, createdById: admin.membership!.id,
      }),
    );
    expect(created.createdById).toBe(admin.membership!.id);
  });

  it("lists only the organization's invitations, newest first", async () => {
    const { invites } = repository();
    const org = await currentOrg();
    const outsider = await signInAsOutsider();
    await prisma.invite.create({ data: { orgId: outsider.org.id, code: "theirs", role: "MANAGER" } });
    // Explicit timestamps: two rows created in the same millisecond would leave
    // the order up to the planner, and the assertion below is about the order.
    await prisma.invite.createMany({ data: [
      { orgId: org.id, code: "older", role: "MANAGER", createdAt: new Date("2026-09-01T10:00:00.000Z") },
      { orgId: org.id, code: "newer", role: "MANAGER", createdAt: new Date("2026-09-01T11:00:00.000Z") },
    ] });

    const listed = await invites.listByOrg(org.id);
    expect(listed.map((invite) => invite.code)).toEqual(["newer", "older"]);
  });

  it("scopes a lookup by id to the organization", async () => {
    const { invites } = repository();
    const org = await currentOrg();
    const outsider = await signInAsOutsider();
    const theirs = await prisma.invite.create({
      data: { orgId: outsider.org.id, code: "theirs", role: "MANAGER" },
    });
    expect(await invites.findInOrg(org.id, theirs.id)).toBeNull();
    expect(await invites.findInOrg(outsider.org.id, theirs.id)).not.toBeNull();
  });

  it("revokes by stamping the moment", async () => {
    const { unitOfWork, invites } = repository();
    const org = await currentOrg();
    const stored = await prisma.invite.create({ data: { orgId: org.id, code: "c", role: "MANAGER" } });
    await unitOfWork.run((context) => invites.revoke(context, stored.id, NOW));
    const after = await prisma.invite.findUniqueOrThrow({ where: { id: stored.id } });
    expect(after.revokedAt?.toISOString()).toBe(NOW.toISOString());
  });

  it("claims an unspent invitation exactly once", async () => {
    const { unitOfWork, invites } = repository();
    const org = await currentOrg();
    const user = await signInAs("Joiner", { membership: false });
    const stored = await prisma.invite.create({ data: { orgId: org.id, code: "c", role: "MANAGER" } });

    await expect(unitOfWork.run((context) => invites.claim(context, stored.id, user.user.id, NOW)))
      .resolves.toBe(true);
    await expect(unitOfWork.run((context) => invites.claim(context, stored.id, user.user.id, NOW)))
      .resolves.toBe(false);

    const after = await prisma.invite.findUniqueOrThrow({ where: { id: stored.id } });
    expect(after.usedById).toBe(user.user.id);
  });

  it("finds an invitation by its code inside a transaction", async () => {
    const { unitOfWork, invites } = repository();
    const org = await currentOrg();
    await prisma.invite.create({ data: { orgId: org.id, code: "findable", role: "GUEST" } });
    const found = await unitOfWork.run((context) => invites.findByCode(context, "findable"));
    expect(found?.role).toBe("GUEST");
    expect(await unitOfWork.run((context) => invites.findByCode(context, "nope"))).toBeNull();
  });

  it("rolls the invitation back when the surrounding transaction fails", async () => {
    const { unitOfWork, invites } = repository();
    const org = await currentOrg();
    await expect(unitOfWork.run(async (context) => {
      await invites.create(context, {
        id: "44444444-4444-4444-4444-444444444444", orgId: org.id, code: "doomed",
        role: "MANAGER", email: null, expiresAt: null, createdById: null,
      });
      throw new Error("the rest of the operation failed");
    })).rejects.toThrow("the rest of the operation failed");
    expect(await prisma.invite.findUnique({ where: { code: "doomed" } })).toBeNull();
  });
});
