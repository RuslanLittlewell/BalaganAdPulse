import { http as mock, HttpResponse } from "msw";
import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Routes, Route } from "react-router-dom";
import { renderWithProviders, server } from "@test/shared/index.js";
import { LoadedTaskCalendar as TaskCalendar } from "@test/shared/task-widgets.js";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
  vi.setSystemTime(new Date(2026, 9, 20, 14, 32));
  server.use(mock.get("/api/tasks", () => HttpResponse.json([])));
});

afterEach(() => {
  vi.useRealTimers();
});

function calendar() {
  return renderWithProviders(
    <Routes><Route path="*" element={<TaskCalendar />} /></Routes>,
    { route: "/tasks" },
  );
}

const lines = () => screen.queryAllByTestId("calendar-now");

describe("the current time in the calendar", () => {
  it("is drawn across today's column alone, at the time it is", async () => {
    calendar();

    const tuesday = await screen.findByRole("group", { name: "вторник, 20 октября" });
    expect(lines()).toHaveLength(1);
    expect(within(tuesday).getByTestId("calendar-now")).toHaveAttribute("data-now", "14:32");
  });

  it("moves on as time passes", async () => {
    calendar();
    await screen.findByTestId("calendar-now");

    act(() => { vi.advanceTimersByTime(2 * 60_000); });

    expect(screen.getByTestId("calendar-now")).toHaveAttribute("data-now", "14:34");
  });

  it("is not drawn in a week that does not hold today", async () => {
    calendar();
    await screen.findByTestId("calendar-now");

    await userEvent.click(screen.getByRole("button", { name: "Следующая неделя" }));

    await screen.findByText("26 октября – 1 ноября 2026");
    expect(lines()).toHaveLength(0);
  });
});
