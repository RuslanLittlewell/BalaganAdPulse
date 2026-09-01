import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Prisma } from "@prisma/client";
import { PrismaClientRepository } from "../../src/modules/clients/infrastructure/prisma-client-repository.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { PrismaUnitOfWork } from "../../src/shared/infrastructure/prisma-unit-of-work.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { currentOrg, grantAccess, signInAs, signInAsOutsider } from "../helpers/auth.js";

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

function repository() {
  const unitOfWork = new PrismaUnitOfWork<Prisma.TransactionClient>(prisma);
  return { unitOfWork, clients: new PrismaClientRepository(prisma, unitOfWork) };
}

const NEW = (id: string, orgId: string, name = "Acme") => ({ id, orgId, name });

describe("Prisma client repository", () => {
  it("stores a client against the organization and grants the creator when asked", async () => {
    const { unitOfWork, clients } = repository();
    const manager = await signInAs("Manager", { role: "MANAGER" });
    const org = await currentOrg();

    const created = await unitOfWork.run((context) =>
      clients.create(context, NEW("11111111-1111-1111-1111-111111111111", org.id), manager.membership!.id),
    );
    expect(created.orgId).toBe(org.id);
    const grants = await prisma.clientAccess.findMany({ where: { membershipId: manager.membership!.id } });
    expect(grants.map((grant) => grant.clientId)).toEqual([created.id]);
  });

  it("records no grant when none was asked for", async () => {
    const { unitOfWork, clients } = repository();
    const org = await currentOrg();
    await unitOfWork.run((context) =>
      clients.create(context, NEW("22222222-2222-2222-2222-222222222222", org.id), undefined),
    );
    expect(await prisma.clientAccess.count()).toBe(0);
  });

  it("keeps every contact-book field through a round trip", async () => {
    const { unitOfWork, clients } = repository();
    const org = await currentOrg();
    const contact = {
      fullName: "Иван Иванов", organization: 'ООО "Акме"', unp: "123456789",
      phone: "+375 29 000-00-00", telegram: "@acme", email: "hello@acme.by", website: "https://acme.by",
    };
    const created = await unitOfWork.run((context) =>
      clients.create(context, { ...NEW("33333333-3333-3333-3333-333333333333", org.id), ...contact }, undefined),
    );
    expect(created).toMatchObject(contact);
  });

  describe("reach translation", () => {
    it("shows an admin every client of the organization", async () => {
      const { clients } = repository();
      const admin = await signInAs("Admin", { role: "ADMIN" });
      const other = await signInAs("Other", { role: "MANAGER" });
      const { clientId } = await seedProject(other.user.id, "Theirs");
      const outsider = await signInAsOutsider();

      const listed = await clients.listReachable(admin.actor!);
      expect(listed.map((client) => client.id)).toEqual([clientId]);
      expect(await clients.findReachable(admin.actor!, outsider.client.id)).toBeNull();
    });

    it("shows a manager only what a grant names", async () => {
      const { clients } = repository();
      const admin = await signInAs("Admin", { role: "ADMIN" });
      const granted = await seedProject(admin.user.id, "Granted");
      await seedProject(admin.user.id, "Ungranted");
      const manager = await signInAs("Manager", { role: "MANAGER" });
      await grantAccess(manager.membership!.id, granted.clientId);

      expect((await clients.listReachable(manager.actor!)).map((c) => c.id)).toEqual([granted.clientId]);
      expect(await clients.findReachable(manager.actor!, granted.clientId)).not.toBeNull();
    });

    it("hides an ungranted client behind the same nothing as a missing one", async () => {
      const { clients } = repository();
      const admin = await signInAs("Admin", { role: "ADMIN" });
      const { clientId } = await seedProject(admin.user.id, "Theirs");
      const manager = await signInAs("Manager", { role: "MANAGER" });

      expect(await clients.findReachable(manager.actor!, clientId)).toBeNull();
      expect(await clients.findReachable(manager.actor!, "00000000-0000-0000-0000-000000000000")).toBeNull();
    });

    it("counts a project-scoped grant as reaching the client it belongs to", async () => {
      const { clients } = repository();
      const admin = await signInAs("Admin", { role: "ADMIN" });
      const { clientId, projectId } = await seedProject(admin.user.id, "Acme");
      const manager = await signInAs("Manager", { role: "MANAGER" });
      await grantAccess(manager.membership!.id, clientId, projectId);

      expect((await clients.reachableIds(manager.actor!))).toEqual([clientId]);
    });
  });

  it("deleting a client takes its projects and campaigns with it", async () => {
    const { unitOfWork, clients } = repository();
    const admin = await signInAs("Admin", { role: "ADMIN" });
    const { clientId, projectId } = await seedProject(admin.user.id, "Acme");
    await prisma.campaign.create({ data: { projectId, name: "Main", position: 0 } });

    await unitOfWork.run((context) => clients.delete(context, clientId));

    expect(await prisma.client.findUnique({ where: { id: clientId } })).toBeNull();
    expect(await prisma.project.findUnique({ where: { id: projectId } })).toBeNull();
    expect(await prisma.campaign.count()).toBe(0);
  });

  it("rolls the client back when the surrounding transaction fails", async () => {
    const { unitOfWork, clients } = repository();
    const org = await currentOrg();
    await expect(unitOfWork.run(async (context) => {
      await clients.create(context, NEW("44444444-4444-4444-4444-444444444444", org.id, "Doomed"), undefined);
      throw new Error("the rest of the operation failed");
    })).rejects.toThrow("the rest of the operation failed");
    expect(await prisma.client.count()).toBe(0);
  });
});
