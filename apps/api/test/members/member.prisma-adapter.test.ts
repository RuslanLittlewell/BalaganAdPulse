import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Prisma } from "@prisma/client";
import { PrismaAccessRepository } from "../../src/modules/members/infrastructure/prisma-access-repository.js";
import { PrismaMemberDirectory } from "../../src/modules/members/infrastructure/prisma-member-directory.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { PrismaUnitOfWork } from "../../src/shared/infrastructure/prisma-unit-of-work.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { currentOrg, grantAccess, signInAs, signInAsOutsider } from "../helpers/auth.js";

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

function adapters() {
  const unitOfWork = new PrismaUnitOfWork<Prisma.TransactionClient>(prisma);
  return {
    unitOfWork,
    directory: new PrismaMemberDirectory(prisma, unitOfWork),
    access: new PrismaAccessRepository(prisma, unitOfWork),
  };
}

describe("Prisma member directory", () => {
  it("lists the organization's members oldest first, with their identity", async () => {
    const org = await currentOrg();
    const first = await signInAs("First", { role: "ADMIN" });
    await signInAs("Second", { role: "GUEST" });
    const outsider = await signInAsOutsider();

    const listed = await adapters().directory.listByOrg(org.id);
    expect(listed.map((member) => member.name)).toEqual(["First", "Second"]);
    expect(listed[0]).toMatchObject({
      userId: first.user.id, email: first.user.email, role: "ADMIN", status: "ACTIVE",
    });
    expect(listed.map((member) => member.userId)).not.toContain(outsider.user.id);
  });

  it("scopes a lookup by id to the organization", async () => {
    const org = await currentOrg();
    const outsider = await signInAsOutsider();
    const { directory } = adapters();
    expect(await directory.findInOrg(org.id, outsider.membership.id)).toBeNull();
    expect(await directory.findInOrg(outsider.org.id, outsider.membership.id)).not.toBeNull();
  });

  it("updates role and status", async () => {
    const member = await signInAs("Member", { role: "MANAGER" });
    const { unitOfWork, directory } = adapters();
    const updated = await unitOfWork.run((context) =>
      directory.update(context, member.membership!.id, { role: "GUEST", status: "SUSPENDED" }),
    );
    expect(updated).toMatchObject({ role: "GUEST", status: "SUSPENDED" });
  });

  it("counts only other active admins", async () => {
    const org = await currentOrg();
    const admin = await signInAs("Admin", { role: "ADMIN" });
    const { directory } = adapters();
    expect(await directory.countOtherActiveAdmins(org.id, admin.membership!.id)).toBe(0);

    await signInAs("Dormant", { role: "ADMIN", status: "SUSPENDED" });
    expect(await directory.countOtherActiveAdmins(org.id, admin.membership!.id)).toBe(0);

    await signInAs("Second", { role: "ADMIN" });
    expect(await directory.countOtherActiveAdmins(org.id, admin.membership!.id)).toBe(1);
  });

  it("removes a membership but leaves the account and its business data standing", async () => {
    const member = await signInAs("Member", { role: "MANAGER" });
    const { clientId, projectId } = await seedProject(member.user.id, "Acme");
    const { unitOfWork, directory } = adapters();

    await unitOfWork.run((context) => directory.remove(context, member.membership!.id));

    expect(await prisma.membership.findUnique({ where: { id: member.membership!.id } })).toBeNull();
    expect(await prisma.user.findUnique({ where: { id: member.user.id } })).not.toBeNull();
    expect(await prisma.client.findUnique({ where: { id: clientId } })).not.toBeNull();
    expect(await prisma.project.findUnique({ where: { id: projectId } })).not.toBeNull();
  });
});

describe("Prisma access repository", () => {
  it("reports the projects of each client asked for, and omits foreign clients", async () => {
    const org = await currentOrg();
    const admin = await signInAs("Admin", { role: "ADMIN" });
    const { clientId, projectId } = await seedProject(admin.user.id, "Acme");
    const outsider = await signInAsOutsider();

    const found = await adapters().access.projectsByClient(org.id, [clientId, outsider.client.id]);
    expect([...found.keys()]).toEqual([clientId]);
    expect(found.get(clientId)).toEqual([projectId]);
  });

  it("replaces a member's grants atomically", async () => {
    const admin = await signInAs("Admin", { role: "ADMIN" });
    const member = await signInAs("Member", { role: "MANAGER" });
    const acme = await seedProject(admin.user.id, "Acme");
    const globex = await seedProject(admin.user.id, "Globex");
    await grantAccess(member.membership!.id, globex.clientId);

    const { unitOfWork, access } = adapters();
    await unitOfWork.run((context) => access.replace(context, member.membership!.id, [
      { clientId: acme.clientId, projectId: null },
      { clientId: acme.clientId, projectId: acme.projectId },
    ]));

    const stored = await access.listFor(member.membership!.id);
    expect(stored.map((grant) => grant.clientId)).toEqual([acme.clientId, acme.clientId]);
    expect(stored.map((grant) => grant.projectId).sort()).toEqual([acme.projectId, null].sort());
  });

  it("leaves the previous grants standing when the transaction fails", async () => {
    const admin = await signInAs("Admin", { role: "ADMIN" });
    const member = await signInAs("Member", { role: "MANAGER" });
    const acme = await seedProject(admin.user.id, "Acme");
    await grantAccess(member.membership!.id, acme.clientId);

    const { unitOfWork, access } = adapters();
    await expect(unitOfWork.run(async (context) => {
      await access.replace(context, member.membership!.id, []);
      throw new Error("the rest of the operation failed");
    })).rejects.toThrow("the rest of the operation failed");

    expect(await access.listFor(member.membership!.id)).toHaveLength(1);
  });

  it("touches only the member it was asked about", async () => {
    const admin = await signInAs("Admin", { role: "ADMIN" });
    const one = await signInAs("One", { role: "MANAGER" });
    const two = await signInAs("Two", { role: "MANAGER" });
    const acme = await seedProject(admin.user.id, "Acme");
    await grantAccess(two.membership!.id, acme.clientId);

    const { unitOfWork, access } = adapters();
    await unitOfWork.run((context) => access.replace(context, one.membership!.id, []));

    expect(await access.listFor(two.membership!.id)).toHaveLength(1);
  });
});
