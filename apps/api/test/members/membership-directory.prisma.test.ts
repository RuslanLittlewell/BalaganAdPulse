import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaMembershipDirectory } from "../../src/modules/members/infrastructure/prisma-membership-directory.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { resetDb } from "../helpers/db.js";
import { signInAs } from "../helpers/auth.js";

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

const directory = () => new PrismaMembershipDirectory(prisma);

describe("Prisma membership directory", () => {
  it("resolves an active membership into an ActorContext", async () => {
    const signedIn = await signInAs("Buyer", { role: "MANAGER" });
    await expect(directory().findActiveByUserId(signedIn.user.id)).resolves.toEqual({
      userId: signedIn.user.id,
      membershipId: signedIn.membership!.id,
      orgId: signedIn.membership!.orgId,
      role: "MANAGER",
    });
  });

  it("returns nothing for a user who is not a member at all", async () => {
    const signedIn = await signInAs("Stranger", { membership: false });
    await expect(directory().findActiveByUserId(signedIn.user.id)).resolves.toBeNull();
  });

  it("returns nothing for a suspended member", async () => {
    const signedIn = await signInAs("Dormant", { status: "SUSPENDED" });
    await expect(directory().findActiveByUserId(signedIn.user.id)).resolves.toBeNull();
  });

  it("reads the role as it currently stands", async () => {
    const signedIn = await signInAs("Boss", { role: "ADMIN" });
    await prisma.membership.update({
      where: { id: signedIn.membership!.id },
      data: { role: "GUEST" },
    });
    await expect(directory().findActiveByUserId(signedIn.user.id))
      .resolves.toMatchObject({ role: "GUEST" });
  });

  it("returns nothing for a user id that does not exist", async () => {
    await expect(directory().findActiveByUserId("00000000-0000-0000-0000-000000000000"))
      .resolves.toBeNull();
  });
});
