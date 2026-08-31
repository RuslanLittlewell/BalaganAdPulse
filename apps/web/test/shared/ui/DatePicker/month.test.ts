import { dayLabel, fromIso, toIso } from "@/shared/ui/DatePicker/month.js";

describe("dayLabel", () => {
  it("names a day in full Russian, without the weekday", () => {
    expect(dayLabel("2026-08-03")).toBe("03 августа 2026 г.");
    expect(dayLabel("2026-12-31")).toBe("31 декабря 2026 г.");
  });
});

describe("fromIso and toIso", () => {
  it("round-trips an ISO day through the calendar's Date", () => {
    expect(toIso(fromIso("2026-08-03"))).toBe("2026-08-03");
    expect(toIso(fromIso("2026-01-01"))).toBe("2026-01-01");
  });

  it("builds a local-midnight date, so the pinned UTC+9 zone cannot shift the day", () => {
    const date = fromIso("2026-08-03");
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(7);
    expect(date.getDate()).toBe(3);
  });

  it("pads month and day back to two digits", () => {
    expect(toIso(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});
