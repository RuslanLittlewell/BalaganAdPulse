import { describe, expect, it } from "vitest";
import type { ActorContext } from "../../src/shared/application/index.js";
import type { TransactionContext } from "../../src/shared/application/unit-of-work.js";
import { DeterministicIdGenerator } from "../../src/shared/infrastructure/id-generator.js";
import { createProjectLayoutUseCases } from "../../src/modules/project-layout/index.js";
import type { StoredLayout } from "../../src/modules/project-layout/index.js";

const member: ActorContext = { userId: "u1", membershipId: "m1", orgId: "org1", role: "MANAGER" };

const EMPTY: StoredLayout = { groups: [], placements: [] };

function fixture(reachable: string[] = ["p1", "p2", "p3"], stored: StoredLayout = EMPTY) {
  const context = {} as TransactionContext;
  const layouts = new Map<string, StoredLayout>([[member.membershipId, stored]]);
  const useCases = createProjectLayoutUseCases({
    layouts: {
      read: async (membershipId) => layouts.get(membershipId) ?? EMPTY,
      replace: async (_tx, membershipId, layout) => { layouts.set(membershipId, layout); },
      createGroup: async (_tx, { id, membershipId, name, position }) => {
        const current = layouts.get(membershipId) ?? EMPTY;
        const group = { id, name, position };
        layouts.set(membershipId, { ...current, groups: [...current.groups, group] });
        return group;
      },
      deleteGroup: async (_tx, membershipId, groupId) => {
        const current = layouts.get(membershipId) ?? EMPTY;
        layouts.set(membershipId, {
          ...current,
          groups: current.groups.filter((group) => group.id !== groupId),
        });
      },
    },
    projects: { reachableIds: async () => reachable },
    ids: new DeterministicIdGenerator(["g-new"]),
    unitOfWork: { run: (work) => work(context) },
  });
  return { useCases, layouts };
}

describe("reading a layout", () => {
  it("shows an untouched list in the order the projects come in", async () => {
    const { useCases } = fixture();
    expect(await useCases.read(member)).toEqual({
      pinned: [],
      items: [
        { type: "project", projectId: "p1" },
        { type: "project", projectId: "p2" },
        { type: "project", projectId: "p3" },
      ],
    });
  });

  it("puts pinned projects apart and keeps groups among the items", async () => {
    const { useCases } = fixture(["p1", "p2", "p3"], {
      groups: [{ id: "g1", name: "Клиенты", position: 1 }],
      placements: [
        { projectId: "p3", groupId: null, position: 0, pinned: true },
        { projectId: "p1", groupId: null, position: 0, pinned: false },
        { projectId: "p2", groupId: "g1", position: 0, pinned: false },
      ],
    });

    expect(await useCases.read(member)).toEqual({
      pinned: ["p3"],
      items: [
        { type: "project", projectId: "p1" },
        { type: "group", groupId: "g1", name: "Клиенты", projectIds: ["p2"] },
      ],
    });
  });

  it("appends a project the arrangement does not place yet", async () => {
    const { useCases } = fixture(["p1", "p2"], {
      groups: [],
      placements: [{ projectId: "p2", groupId: null, position: 0, pinned: false }],
    });

    expect((await useCases.read(member)).items).toEqual([
      { type: "project", projectId: "p2" },
      { type: "project", projectId: "p1" },
    ]);
  });

  it("forgets a project the member may no longer reach", async () => {
    const { useCases } = fixture(["p1"], {
      groups: [{ id: "g1", name: "Клиенты", position: 1 }],
      placements: [
        { projectId: "p1", groupId: null, position: 0, pinned: false },
        { projectId: "gone", groupId: "g1", position: 0, pinned: false },
      ],
    });

    expect(await useCases.read(member)).toEqual({
      pinned: [],
      items: [
        { type: "project", projectId: "p1" },
        { type: "group", groupId: "g1", name: "Клиенты", projectIds: [] },
      ],
    });
  });
});

describe("replacing a layout", () => {
  const withGroup: StoredLayout = { groups: [{ id: "g1", name: "Клиенты", position: 0 }], placements: [] };

  it("stores the arrangement it is given and reads it back", async () => {
    const { useCases } = fixture(["p1", "p2", "p3"], withGroup);

    const layout = await useCases.replace(member, {
      pinned: ["p3"],
      items: [
        { type: "group", groupId: "g1", projectIds: ["p2"] },
        { type: "project", projectId: "p1" },
      ],
    });

    expect(layout).toEqual({
      pinned: ["p3"],
      items: [
        { type: "group", groupId: "g1", name: "Клиенты", projectIds: ["p2"] },
        { type: "project", projectId: "p1" },
      ],
    });
  });

  it("refuses a project the member may not reach", async () => {
    const { useCases, layouts } = fixture(["p1"], withGroup);
    await expect(useCases.replace(member, {
      pinned: [], items: [{ type: "project", projectId: "hidden" }],
    })).rejects.toMatchObject({ category: "not-found" });
    expect(layouts.get(member.membershipId)).toEqual(withGroup);
  });

  it("refuses a group that is not the member's own", async () => {
    const { useCases } = fixture(["p1"], withGroup);
    await expect(useCases.replace(member, {
      pinned: [], items: [{ type: "group", groupId: "other", projectIds: [] }],
    })).rejects.toMatchObject({ category: "not-found" });
  });

  it("refuses the same project placed twice", async () => {
    const { useCases } = fixture(["p1"], withGroup);
    await expect(useCases.replace(member, {
      pinned: ["p1"],
      items: [{ type: "project", projectId: "p1" }],
    })).rejects.toMatchObject({ category: "validation" });
  });

  it("keeps a group the arrangement leaves out, after the items it names", async () => {
    const { useCases } = fixture(["p1"], withGroup);
    const layout = await useCases.replace(member, {
      pinned: [], items: [{ type: "project", projectId: "p1" }],
    });
    expect(layout.items).toEqual([
      { type: "project", projectId: "p1" },
      { type: "group", groupId: "g1", name: "Клиенты", projectIds: [] },
    ]);
  });
});

describe("groups", () => {
  it("creates an empty group at the end of the list", async () => {
    const { useCases } = fixture(["p1"]);
    const group = await useCases.createGroup(member, "Клиенты");
    expect(group).toEqual({ id: "g-new", name: "Клиенты", position: 1 });
    expect((await useCases.read(member)).items.at(-1)).toEqual({
      type: "group", groupId: "g-new", name: "Клиенты", projectIds: [],
    });
  });

  it("refuses a group without a name", async () => {
    const { useCases } = fixture();
    await expect(useCases.createGroup(member, "   ")).rejects.toMatchObject({ category: "validation" });
  });

  it("deletes an empty group", async () => {
    const { useCases } = fixture(["p1"], {
      groups: [{ id: "g1", name: "Клиенты", position: 0 }], placements: [],
    });
    await useCases.deleteGroup(member, "g1");
    expect((await useCases.read(member)).items).toEqual([{ type: "project", projectId: "p1" }]);
  });

  it("refuses to delete a group that still holds a project", async () => {
    const { useCases } = fixture(["p1"], {
      groups: [{ id: "g1", name: "Клиенты", position: 0 }],
      placements: [{ projectId: "p1", groupId: "g1", position: 0, pinned: false }],
    });
    await expect(useCases.deleteGroup(member, "g1")).rejects.toMatchObject({ category: "conflict" });
  });

  it("answers not found for a group that is not the member's", async () => {
    const { useCases } = fixture(["p1"]);
    await expect(useCases.deleteGroup(member, "other")).rejects.toMatchObject({ category: "not-found" });
  });
});
