import { formatAgo } from "@/widgets/project-documents/formatAgo.js";

const now = new Date("2026-10-30T12:00:00.000Z").getTime();
const before = (minutes: number) => new Date(now - minutes * 60_000).toISOString();

describe("how long ago a document changed", () => {
  it("says now within a minute, then counts minutes and hours", () => {
    expect(formatAgo(before(0.5), now)).toBe("сейчас");
    expect(formatAgo(before(15), now)).toBe("15 минут назад");
    expect(formatAgo(before(3 * 60), now)).toBe("3 часа назад");
  });

  it("counts days for a week, starting with yesterday", () => {
    expect(formatAgo(before(30 * 60), now)).toBe("вчера");
    expect(formatAgo(before(3 * 24 * 60), now)).toBe("3 дня назад");
    expect(formatAgo(before(7 * 24 * 60), now)).toBe("7 дней назад");
  });

  it("gives the date once more than a week has passed, and now for a time ahead of the clock", () => {
    expect(formatAgo(before(10 * 24 * 60), now)).toBe("20 октября 2026 г.");
    expect(formatAgo(before(-5), now)).toBe("сейчас");
  });
});
