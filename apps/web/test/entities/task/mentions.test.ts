import {
  bodySegments,
  insertMention,
  matchingMembers,
  mentionQueryAt,
  taggableMembers,
  tagsStillIn,
} from "@/entities/task/index.js";

const member = (id: string, name: string, role = "MANAGER", status = "ACTIVE") => ({ id, name, role, status });

describe("finding the tag being typed", () => {
  it("sees an @ at the start", () => {
    expect(mentionQueryAt("@Пе", 3)).toEqual({ start: 0, text: "Пе" });
  });

  it("sees an @ after a space", () => {
    expect(mentionQueryAt("глянь @А", 8)).toEqual({ start: 6, text: "А" });
  });

  it("sees a bare @", () => {
    expect(mentionQueryAt("тест @", 6)).toEqual({ start: 5, text: "" });
  });

  it("ignores an @ inside a word, such as an address", () => {
    expect(mentionQueryAt("a@b", 3)).toBeNull();
  });

  it("ignores an @ once the caret has moved past a space", () => {
    expect(mentionQueryAt("@Пётр ", 6)).toBeNull();
  });

  it("looks only before the caret", () => {
    expect(mentionQueryAt("@Пе рядом", 3)).toEqual({ start: 0, text: "Пе" });
  });
});

describe("who can be tagged on a task", () => {
  const task = { participantIds: ["a"], visibleToClient: false };
  const members = [
    member("a", "Анна"), member("b", "Борис"), member("d", "Дмитрий", "ADMIN"),
    member("e", "Егор", "MANAGER", "SUSPENDED"), member("f", "Клиент", "CLIENT"), member("me", "Я", "ADMIN"),
  ];

  it("is every active employee, without the author", () => {
    expect(taggableMembers(task, members, "me").map((m) => m.id)).toEqual(["a", "b", "d"]);
  });

  it("leaves out the suspended", () => {
    expect(taggableMembers(task, members, "me").map((m) => m.id)).not.toContain("e");
  });

  it("includes a client's person only on a shared task they are named on", () => {
    const shared = { participantIds: ["f"], visibleToClient: true };
    expect(taggableMembers(shared, members, "me").map((m) => m.id)).toContain("f");
    expect(taggableMembers({ ...shared, visibleToClient: false }, members, "me").map((m) => m.id))
      .not.toContain("f");
    expect(taggableMembers({ participantIds: [], visibleToClient: true }, members, "me").map((m) => m.id))
      .not.toContain("f");
  });
});

describe("narrowing the offer", () => {
  it("keeps names containing the typed letters, ignoring case, in alphabetical order", () => {
    const people = [member("1", "Пётр"), member("2", "Анна"), member("3", "Антон")];
    expect(matchingMembers(people, "ан").map((m) => m.name)).toEqual(["Анна", "Антон"]);
  });

  it("offers everyone for a bare @", () => {
    expect(matchingMembers([member("1", "Пётр"), member("2", "Анна")], "")).toHaveLength(2);
  });
});

describe("inserting a tag", () => {
  it("replaces the typed part with the full name and moves the caret after it", () => {
    const query = { start: 6, text: "Ан" };
    expect(insertMention("глянь @Ан тут", query, 9, "Анна Петрова"))
      .toEqual({ text: "глянь @Анна Петрова  тут", caret: 20 });
  });
});

describe("the tags a comment keeps", () => {
  const chosen = [{ id: "1", name: "Анна" }, { id: "2", name: "Борис" }];

  it("are the chosen people whose tag is still in the text", () => {
    expect(tagsStillIn("@Анна привет", chosen)).toEqual(["1"]);
  });

  it("drop a person whose tag was deleted", () => {
    expect(tagsStillIn("привет", chosen)).toEqual([]);
  });
});

describe("marking tags in a comment", () => {
  it("splits the text around tagged names", () => {
    expect(bodySegments("@Анна глянь, @Борис тоже", ["Анна", "Борис"])).toEqual([
      { text: "@Анна", tagged: true },
      { text: " глянь, ", tagged: false },
      { text: "@Борис", tagged: true },
      { text: " тоже", tagged: false },
    ]);
  });

  it("leaves untagged text whole", () => {
    expect(bodySegments("просто текст @Анна", [])).toEqual([{ text: "просто текст @Анна", tagged: false }]);
  });

  it("treats regex characters in a name as plain text", () => {
    expect(bodySegments("@А.+ тут", ["А.+"])[0]).toEqual({ text: "@А.+", tagged: true });
  });
});
