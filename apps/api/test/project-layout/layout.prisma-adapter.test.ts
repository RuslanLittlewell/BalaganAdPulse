import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Prisma } from "@prisma/client";
import { PrismaProjectLayoutRepository } from "../../src/modules/project-layout/infrastructure/prisma-project-layout-repository.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";
import { PrismaUnitOfWork } from "../../src/shared/infrastructure/prisma-unit-of-work.js";
import { resetDb, seedProject } from "../helpers/db.js";
import { signInAs } from "../helpers/auth.js";

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

function repository() {
  const unitOfWork = new PrismaUnitOfWork<Prisma.TransactionClient>(prisma);
  return { unitOfWork, layouts: new PrismaProjectLayoutRepository(prisma, unitOfWork) };
}

describe("Prisma project layout repository", () => {
  it("reads back the groups and placements one member stored", async () => {
    const { unitOfWork, layouts } = repository();
    const member = await signInAs("Buyer");
    const { projectId } = await seedProject(member.user.id, "Acme");
    const { projectId: pinnedId } = await seedProject(member.user.id, "Beta");
    const membershipId = member.membership!.id;

    const group = await unitOfWork.run((context) => layouts.createGroup(context, {
      id: "22222222-2222-2222-2222-222222222222", membershipId, name: "Клиенты", position: 1,
    }));
    await unitOfWork.run((context) => layouts.replace(context, membershipId, {
      groups: [{ ...group, position: 0 }],
      placements: [
        { projectId: pinnedId, groupId: null, position: 0, pinned: true },
        { projectId, groupId: group.id, position: 0, pinned: false },
      ],
    }));

    expect(await layouts.read(membershipId)).toEqual({
      groups: [{ id: group.id, name: "Клиенты", position: 0 }],
      placements: [
        { projectId: pinnedId, groupId: null, position: 0, pinned: true },
        { projectId, groupId: group.id, position: 0, pinned: false },
      ],
    });
  });

  it("keeps one member's arrangement out of another's", async () => {
    const { unitOfWork, layouts } = repository();
    const mine = await signInAs("Mine");
    const theirs = await signInAs("Theirs");
    const { projectId } = await seedProject(mine.user.id, "Acme");

    await unitOfWork.run((context) => layouts.replace(context, mine.membership!.id, {
      groups: [],
      placements: [{ projectId, groupId: null, position: 3, pinned: true }],
    }));

    expect(await layouts.read(theirs.membership!.id)).toEqual({ groups: [], placements: [] });
  });

  it("forgets the placements a new arrangement does not name", async () => {
    const { unitOfWork, layouts } = repository();
    const member = await signInAs("Buyer");
    const { projectId } = await seedProject(member.user.id, "Acme");
    const { projectId: otherId } = await seedProject(member.user.id, "Beta");
    const membershipId = member.membership!.id;

    await unitOfWork.run((context) => layouts.replace(context, membershipId, {
      groups: [],
      placements: [
        { projectId, groupId: null, position: 0, pinned: false },
        { projectId: otherId, groupId: null, position: 1, pinned: false },
      ],
    }));
    await unitOfWork.run((context) => layouts.replace(context, membershipId, {
      groups: [],
      placements: [{ projectId: otherId, groupId: null, position: 0, pinned: false }],
    }));

    const stored = await layouts.read(membershipId);
    expect(stored.placements).toEqual([{ projectId: otherId, groupId: null, position: 0, pinned: false }]);
  });

  it("drops a placement with the project it points at", async () => {
    const { unitOfWork, layouts } = repository();
    const member = await signInAs("Buyer");
    const { projectId } = await seedProject(member.user.id, "Acme");
    const membershipId = member.membership!.id;

    await unitOfWork.run((context) => layouts.replace(context, membershipId, {
      groups: [],
      placements: [{ projectId, groupId: null, position: 0, pinned: false }],
    }));
    await prisma.project.delete({ where: { id: projectId } });

    expect((await layouts.read(membershipId)).placements).toEqual([]);
  });

  it("deletes an empty group and leaves the rest of the arrangement", async () => {
    const { unitOfWork, layouts } = repository();
    const member = await signInAs("Buyer");
    const { projectId } = await seedProject(member.user.id, "Acme");
    const membershipId = member.membership!.id;

    const group = await unitOfWork.run((context) => layouts.createGroup(context, {
      id: "33333333-3333-3333-3333-333333333333", membershipId, name: "Пусто", position: 1,
    }));
    await unitOfWork.run((context) => layouts.replace(context, membershipId, {
      groups: [group],
      placements: [{ projectId, groupId: null, position: 0, pinned: false }],
    }));
    await unitOfWork.run((context) => layouts.deleteGroup(context, membershipId, group.id));

    expect(await layouts.read(membershipId)).toEqual({
      groups: [],
      placements: [{ projectId, groupId: null, position: 0, pinned: false }],
    });
  });
});
