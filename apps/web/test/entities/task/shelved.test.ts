import { isShelved } from "@/entities/task/index.js";

const NOW = new Date("2026-10-22T12:00:00.000Z");

const archived = (archivedAt: string | null) => ({ column: "ARCHIVED" as const, archivedAt });

describe("a shelved task", () => {
  it("is one that has been archived for seven days", () => {
    expect(isShelved(archived("2026-10-15T12:00:00.000Z"), NOW)).toBe(true);
  });

  it("is one archived for longer than a week", () => {
    expect(isShelved(archived("2026-10-01T09:00:00.000Z"), NOW)).toBe(true);
  });

  it("is not one archived less than seven days ago", () => {
    expect(isShelved(archived("2026-10-15T12:00:01.000Z"), NOW)).toBe(false);
  });

  it("is not a task with no archiving moment", () => {
    expect(isShelved(archived(null), NOW)).toBe(false);
  });

  it("is not a task outside the archive column", () => {
    expect(isShelved({ column: "DONE", archivedAt: "2026-01-01T00:00:00.000Z" }, NOW)).toBe(false);
  });
});
