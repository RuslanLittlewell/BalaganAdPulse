import { groupByDay } from "@/widgets/activity-log-modal/days.js";

const NOW = new Date("2026-10-22T03:00:00.000Z");

describe("grouping the history by day", () => {
  it("labels today, yesterday, earlier days and another year's, keeping the order", () => {
    const groups = groupByDay([
      { id: "a", createdAt: "2026-10-22T01:00:00.000Z" },
      { id: "b", createdAt: "2026-10-21T23:00:00.000Z" },
      { id: "c", createdAt: "2026-10-21T02:00:00.000Z" },
      { id: "d", createdAt: "2026-10-17T05:00:00.000Z" },
      { id: "e", createdAt: "2025-12-31T05:00:00.000Z" },
    ], NOW);

    expect(groups.map((group) => [group.label, group.events.map((event) => event.id)])).toEqual([
      ["Сегодня", ["a", "b"]],
      ["Вчера", ["c"]],
      ["17 октября", ["d"]],
      ["31 декабря 2025", ["e"]],
    ]);
  });
});
