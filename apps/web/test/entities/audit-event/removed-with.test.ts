import { describeRemovedWith } from "@/entities/audit-event/index.js";

const deleted = (entityType: string, changes: unknown) => describeRemovedWith({ entityType, changes: changes as never });

describe("the counts under a deletion", () => {
  it("reads a project's counts in Russian with the plural form of each number", () => {
    expect(deleted("project", { removedWith: { tasks: 12, leads: 30 } }))
      .toBe("Вместе с проектом удалено: 12 задач, 30 лидов");
  });

  it("reads a lead's counts, with one in the singular and two in the few form", () => {
    expect(deleted("lead", { before: { name: "Анна" }, removedWith: { tasks: 1, notes: 2 } }))
      .toBe("Вместе с лидом удалено: 1 задача, 2 заметки");
  });

  it("names the heading by what was deleted", () => {
    expect(deleted("client", { removedWith: { projects: 21 } })).toBe("Вместе с клиентом удалено: 21 проект");
    expect(deleted("task", { removedWith: { comments: 5, files: 1 } })).toBe("Вместе с задачей удалено: 5 комментариев, 1 файл");
  });

  it("shows nothing without counts, with empty counts or for an event that is not a deletion of the four", () => {
    expect(deleted("task", null)).toBeNull();
    expect(deleted("task", { removedWith: {} })).toBeNull();
    expect(deleted("task", { removedWith: { comments: 0 } })).toBeNull();
    expect(deleted("lead", { before: { name: "Анна" } })).toBeNull();
    expect(deleted("report", { removedWith: { tasks: 3 } })).toBeNull();
  });
});

describe("the counts in English", () => {
  afterEach(() => {
    localStorage.removeItem("adpulse.language");
    vi.resetModules();
  });

  it("uses the English heading and plurals", async () => {
    localStorage.setItem("adpulse.language", "en");
    vi.resetModules();
    const { describeRemovedWith: describeEnglish } = await import("@/entities/audit-event/index.js");

    expect(describeEnglish({ entityType: "project", changes: { removedWith: { tasks: 12, leads: 1 } } as never }))
      .toBe("Deleted with the project: 12 tasks, 1 lead");
  });
});
