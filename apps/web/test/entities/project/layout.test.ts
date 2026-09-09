import {
  LIST_END,
  arrangeProjects,
  asArrangement,
  dragId,
  moveInLayout,
  pinProject,
  unpinProject,
  type ProjectLayout,
} from "@/entities/project/index.js";

const layout: ProjectLayout = {
  pinned: ["pinned"],
  items: [
    { type: "project", projectId: "a" },
    { type: "group", groupId: "g1", name: "Клиенты", projectIds: ["b", "c"] },
    { type: "project", projectId: "d" },
  ],
};

const ids = (next: ProjectLayout) =>
  next.items.map((item) => item.type === "project" ? item.projectId : `${item.groupId}(${item.projectIds.join(",")})`);

describe("arranging the known projects", () => {
  it("appends projects the arrangement does not place, in the order given", () => {
    const next = arrangeProjects(layout, ["a", "b", "c", "d", "pinned", "fresh"]);
    expect(ids(next).at(-1)).toBe("fresh");
    expect(next.pinned).toEqual(["pinned"]);
  });

  it("drops projects that are gone, from groups as well", () => {
    const next = arrangeProjects(layout, ["a", "b"]);
    expect(ids(next)).toEqual(["a", "g1(b)"]);
    expect(next.pinned).toEqual([]);
  });
});

describe("moving an item", () => {
  it("reorders two top-level projects", () => {
    expect(ids(moveInLayout(layout, dragId.project("d"), dragId.project("a"))))
      .toEqual(["d", "a", "g1(b,c)"]);
  });

  it("drops a project into a group at the place it was dropped on", () => {
    expect(ids(moveInLayout(layout, dragId.project("a"), dragId.project("c"))))
      .toEqual(["g1(b,a,c)", "d"]);
  });

  it("drops a project onto a group itself, at the end of it", () => {
    expect(ids(moveInLayout(layout, dragId.project("d"), dragId.group("g1"))))
      .toEqual(["a", "g1(b,c,d)"]);
  });

  it("takes a project out of a group onto the top level", () => {
    expect(ids(moveInLayout(layout, dragId.project("b"), dragId.project("a"))))
      .toEqual(["b", "a", "g1(c)", "d"]);
  });

  it("moves a whole group among the top-level items", () => {
    expect(ids(moveInLayout(layout, dragId.group("g1"), dragId.project("a"))))
      .toEqual(["g1(b,c)", "a", "d"]);
  });

  it("moves a project down past the item it was dropped on", () => {
    expect(ids(moveInLayout(layout, dragId.project("a"), dragId.project("d"))))
      .toEqual(["g1(b,c)", "d", "a"]);
  });

  it("moves a group down past the item it was dropped on", () => {
    expect(ids(moveInLayout(layout, dragId.group("g1"), dragId.project("d"))))
      .toEqual(["a", "d", "g1(b,c)"]);
  });

  it("drops a project below everything onto the end of the list", () => {
    expect(ids(moveInLayout(layout, dragId.project("a"), LIST_END)))
      .toEqual(["g1(b,c)", "d", "a"]);
  });

  it("takes a project out of its group when dropped below everything", () => {
    expect(ids(moveInLayout(layout, dragId.project("b"), LIST_END)))
      .toEqual(["a", "g1(c)", "d", "b"]);
  });

  it("drops a group onto the end of the list", () => {
    expect(ids(moveInLayout(layout, dragId.group("g1"), LIST_END)))
      .toEqual(["a", "d", "g1(b,c)"]);
  });

  it("refuses to put a group inside a group", () => {
    expect(moveInLayout(layout, dragId.group("g1"), dragId.project("c"))).toEqual(layout);
  });

  it("leaves the arrangement alone when nothing moved", () => {
    expect(moveInLayout(layout, dragId.project("a"), dragId.project("a"))).toEqual(layout);
  });

  it("keeps pinned projects out of the way", () => {
    expect(moveInLayout(layout, dragId.project("pinned"), dragId.project("a"))).toEqual(layout);
  });
});

describe("pinning", () => {
  it("pins a top-level project at the end of the pinned ones", () => {
    const next = pinProject(layout, "a");
    expect(next.pinned).toEqual(["pinned", "a"]);
    expect(ids(next)).toEqual(["g1(b,c)", "d"]);
  });

  it("pins a project out of the group holding it", () => {
    const next = pinProject(layout, "b");
    expect(next.pinned).toEqual(["pinned", "b"]);
    expect(ids(next)).toEqual(["a", "g1(c)", "d"]);
  });

  it("unpins a project to the end of the top level", () => {
    const next = unpinProject(layout, "pinned");
    expect(next.pinned).toEqual([]);
    expect(ids(next)).toEqual(["a", "g1(b,c)", "d", "pinned"]);
  });
});

describe("the arrangement sent to the API", () => {
  it("names the groups without repeating their names", () => {
    expect(asArrangement(layout)).toEqual({
      pinned: ["pinned"],
      items: [
        { type: "project", projectId: "a" },
        { type: "group", groupId: "g1", projectIds: ["b", "c"] },
        { type: "project", projectId: "d" },
      ],
    });
  });
});
