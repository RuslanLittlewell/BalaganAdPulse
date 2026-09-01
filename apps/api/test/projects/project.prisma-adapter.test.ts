import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Prisma } from "@prisma/client";
import { PrismaProjectRepository } from "../../src/modules/projects/infrastructure/prisma-project-repository.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { PrismaUnitOfWork } from "../../src/shared/infrastructure/prisma-unit-of-work.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { grantAccess, signInAs, signInAsOutsider } from "../helpers/auth.js";

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

function repository() {
  const unitOfWork = new PrismaUnitOfWork<Prisma.TransactionClient>(prisma);
  return { unitOfWork, projects: new PrismaProjectRepository(prisma, unitOfWork) };
}

describe("Prisma project repository", () => {
  it("carries the budget as an exact decimal string, never a float", async () => {
    const { unitOfWork, projects } = repository();
    const admin = await signInAs("Admin", { role: "ADMIN" });
    const { clientId } = await seedProject(admin.user.id, "Acme");

    const created = await unitOfWork.run((context) => projects.create(context, {
      id: "11111111-1111-1111-1111-111111111111", clientId, name: "Budgeted",
      monthlyBudget: 1234.56, position: 1,
    }));
    expect(created.monthlyBudget).toBe("1234.56");
  });

  it("counts a client's projects so a new one is appended", async () => {
    const { projects } = repository();
    const admin = await signInAs("Admin", { role: "ADMIN" });
    const { clientId } = await seedProject(admin.user.id, "Acme");
    expect(await projects.countForClient(clientId)).toBe(1);
  });

  describe("reach translation", () => {
    it("shows an admin every project of the organization and nothing beyond it", async () => {
      const { projects } = repository();
      const admin = await signInAs("Admin", { role: "ADMIN" });
      const { projectId } = await seedProject(admin.user.id, "Acme");
      const outsider = await signInAsOutsider();
      const theirProject = await prisma.project.create({
        data: { clientId: outsider.client.id, name: "Theirs", position: 0 },
      });

      expect((await projects.listReachable(admin.actor!)).map((p) => p.id)).toEqual([projectId]);
      expect(await projects.findReachable(admin.actor!, theirProject.id)).toBeNull();
    });

    it("gives a whole-client grant every project of that client", async () => {
      const { projects } = repository();
      const admin = await signInAs("Admin", { role: "ADMIN" });
      const { clientId, projectId } = await seedProject(admin.user.id, "Acme");
      const second = await prisma.project.create({ data: { clientId, name: "Second", position: 1 } });
      const manager = await signInAs("Manager", { role: "MANAGER" });
      await grantAccess(manager.membership!.id, clientId);

      const listed = await projects.listReachable(manager.actor!);
      expect(listed.map((p) => p.id).sort()).toEqual([projectId, second.id].sort());
    });

    it("narrows a project-scoped grant to that project alone", async () => {
      const { projects } = repository();
      const admin = await signInAs("Admin", { role: "ADMIN" });
      const { clientId, projectId } = await seedProject(admin.user.id, "Acme");
      const second = await prisma.project.create({ data: { clientId, name: "Second", position: 1 } });
      const manager = await signInAs("Manager", { role: "MANAGER" });
      await grantAccess(manager.membership!.id, clientId, projectId);

      expect((await projects.listReachable(manager.actor!)).map((p) => p.id)).toEqual([projectId]);
      expect(await projects.findReachable(manager.actor!, second.id)).toBeNull();
    });

    it("narrows a listing to one client on request", async () => {
      const { projects } = repository();
      const admin = await signInAs("Admin", { role: "ADMIN" });
      const acme = await seedProject(admin.user.id, "Acme");
      await seedProject(admin.user.id, "Globex");
      expect((await projects.listReachable(admin.actor!, acme.clientId)).map((p) => p.id))
        .toEqual([acme.projectId]);
    });
  });

  it("deleting a project takes its campaigns with it", async () => {
    const { unitOfWork, projects } = repository();
    const admin = await signInAs("Admin", { role: "ADMIN" });
    const { projectId } = await seedProject(admin.user.id, "Acme");
    await prisma.campaign.create({ data: { projectId, name: "Main", position: 0 } });

    await unitOfWork.run((context) => projects.delete(context, projectId));
    expect(await prisma.project.findUnique({ where: { id: projectId } })).toBeNull();
    expect(await prisma.campaign.count()).toBe(0);
  });

  it("rolls the project back when the surrounding transaction fails", async () => {
    const { unitOfWork, projects } = repository();
    const admin = await signInAs("Admin", { role: "ADMIN" });
    const { clientId } = await seedProject(admin.user.id, "Acme");
    const before = await prisma.project.count();

    await expect(unitOfWork.run(async (context) => {
      await projects.create(context, {
        id: "22222222-2222-2222-2222-222222222222", clientId, name: "Doomed", position: 9,
      });
      throw new Error("the rest of the operation failed");
    })).rejects.toThrow("the rest of the operation failed");
    expect(await prisma.project.count()).toBe(before);
  });
});
