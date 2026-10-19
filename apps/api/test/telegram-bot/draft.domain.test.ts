import { describe, expect, it } from "vitest";
import {
  descriptionOf,
  draftFrom,
  keyedCatalog,
  linkUrl,
  localMoment,
  mayUseBot,
  type ReadTask,
} from "../../src/modules/telegram-bot/index.js";

const catalog = keyedCatalog({
  projects: [
    { id: "p-1", name: "Евроопт", client: "Евроторг" },
    { id: "p-2", name: "Клиника", client: "Медцентр" },
  ],
  members: [
    { id: "m-anna", name: "Анна" },
    { id: "m-boris", name: "Борис" },
  ],
}, "m-anna");

const read = (overrides: Partial<ReadTask> = {}): ReadTask => ({
  title: "Подготовить отчёт",
  details: null,
  projectKey: null,
  participantKeys: [],
  unknownNames: [],
  dueDate: null,
  dueTime: null,
  priority: "MEDIUM",
  checklist: [],
  ...overrides,
});

describe("the catalog the model reads", () => {
  it("keys projects and people in order and marks the speaker", () => {
    expect(catalog.projects.map((project) => project.key)).toEqual(["P1", "P2"]);
    expect(catalog.members).toEqual([
      { id: "m-anna", name: "Анна", key: "M1", speaker: true },
      { id: "m-boris", name: "Борис", key: "M2", speaker: false },
    ]);
  });
});

describe("a draft from what the model read", () => {
  it("maps the keys back to the project and the people, once each", () => {
    const draft = draftFrom(read({ projectKey: "P1", participantKeys: ["M2", "M2", "M1"] }), catalog, "text");

    expect(draft.project).toEqual({ id: "p-1", name: "Евроопт" });
    expect(draft.participants).toEqual([{ id: "m-boris", name: "Борис" }, { id: "m-anna", name: "Анна" }]);
  });

  it("drops a key it does not know, so no project or person comes from outside the catalog", () => {
    const draft = draftFrom(read({ projectKey: "P9", participantKeys: ["M7", "m-boris"] }), catalog, "text");

    expect(draft.project).toBeNull();
    expect(draft.participants).toEqual([]);
  });

  it("keeps a real day and a time that comes with it", () => {
    expect(draftFrom(read({ dueDate: "2026-10-23", dueTime: "18:00" }), catalog, "t")).toMatchObject({
      dueDate: "2026-10-23", dueTime: "18:00",
    });
    expect(draftFrom(read({ dueDate: "2026-02-30", dueTime: "18:00" }), catalog, "t")).toMatchObject({
      dueDate: null, dueTime: null,
    });
    expect(draftFrom(read({ dueDate: null, dueTime: "18:00" }), catalog, "t").dueTime).toBeNull();
    expect(draftFrom(read({ dueDate: "2026-10-23", dueTime: "25:00" }), catalog, "t")).toMatchObject({
      dueDate: "2026-10-23", dueTime: null,
    });
  });

  it("falls back to the beginning of the text for a missing title", () => {
    const text = `  Позвонить   клиенту ${"очень ".repeat(30)}`;
    const draft = draftFrom(read({ title: "   " }), catalog, text);

    expect(draft.title.startsWith("Позвонить клиенту очень")).toBe(true);
    expect(draft.title.length).toBe(80);
    expect(draft.title.endsWith("…")).toBe(true);
    expect(draftFrom(read({ title: "" }), catalog, "Купить кофе").title).toBe("Купить кофе");
  });

  it("takes a known priority and otherwise MEDIUM", () => {
    expect(draftFrom(read({ priority: "URGENT" }), catalog, "t").priority).toBe("URGENT");
    expect(draftFrom(read({ priority: "ASAP" }), catalog, "t").priority).toBe("MEDIUM");
  });

  it("trims the details, the unknown names and the checklist, dropping empty ones", () => {
    const draft = draftFrom(read({
      details: "  ",
      unknownNames: [" Вася ", "Вася", ""],
      checklist: Array.from({ length: 25 }, (_, index) => ` шаг ${index + 1} `),
    }), catalog, "t");

    expect(draft.details).toBeNull();
    expect(draft.unknownNames).toEqual(["Вася"]);
    expect(draft.checklist).toHaveLength(20);
    expect(draft.checklist[0]).toBe("шаг 1");
  });
});

describe("the task description", () => {
  it("is a paragraph per line of the details, or nothing", () => {
    expect(descriptionOf("Сверить цифры\n\n Отправить клиенту ")).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Сверить цифры" }] },
        { type: "paragraph", content: [{ type: "text", text: "Отправить клиенту" }] },
      ],
    });
    expect(descriptionOf(null)).toBeNull();
    expect(descriptionOf(" \n ")).toBeNull();
  });
});

describe("who may use the bot", () => {
  const member = { role: "ADMIN" as const, active: true, organizationActive: true, tasksOn: true };

  it("is an active admin or manager of an active organization with tasks", () => {
    expect(mayUseBot(member)).toBe(true);
    expect(mayUseBot({ ...member, role: "MANAGER" })).toBe(true);
    for (const role of ["GUEST", "CLIENT", "CLIENT_ADMIN"] as const) {
      expect(mayUseBot({ ...member, role })).toBe(false);
    }
    expect(mayUseBot({ ...member, active: false })).toBe(false);
    expect(mayUseBot({ ...member, organizationActive: false })).toBe(false);
    expect(mayUseBot({ ...member, tasksOn: false })).toBe(false);
  });
});

describe("the link and the moment", () => {
  it("opens the bot with the token as its start parameter", () => {
    expect(linkUrl("adpulse_bot", "abc-_1")).toBe("https://t.me/adpulse_bot?start=abc-_1");
  });

  it("reads today's date, weekday and time in the task time zone", () => {
    expect(localMoment(new Date("2026-10-18T22:30:00Z"), "Europe/Minsk")).toEqual({
      date: "2026-10-19", weekday: "понедельник", time: "01:30",
    });
  });
});
