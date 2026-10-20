import { http as mock, HttpResponse } from "msw";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Routes, Route } from "react-router-dom";
import { aTask, renderWithProviders, server } from "@test/shared/index.js";
import { LoadedTaskCalendar as TaskCalendar } from "@test/shared/task-widgets.js";
import type { Task } from "@/entities/task/index.js";

const TODAY = "2026-10-20";

const standUp = aTask({
  id: "stand-up", title: "Планёрка", dueDate: "2026-10-19", dueTime: "10:00", endTime: "10:15",
  repeatEvery: "DAILY", isCall: true,
});

const fortnightly = aTask({
  id: "review", title: "Ревью с клиентом", dueDate: "2026-10-14", dueTime: "16:00",
  repeatEvery: "BIWEEKLY", isCall: true,
});

function calendar(tasks: Task[], onOpen?: (task: Task) => void) {
  server.use(mock.get("/api/tasks", () => HttpResponse.json(tasks)));
  return renderWithProviders(
    <Routes><Route path="*" element={<TaskCalendar today={TODAY} onOpen={onOpen} />} /></Routes>,
    { route: "/tasks" },
  );
}

const day = (name: RegExp) => screen.findByRole("group", { name });

describe("a call in the calendar", () => {
  it("is drawn on every day of the week when it is daily", async () => {
    calendar([standUp]);

    expect(await screen.findAllByText("Планёрка")).toHaveLength(7);
    for (const group of screen.getAllByRole("group")) {
      expect(within(group).getByText("Планёрка")).toBeInTheDocument();
    }
  });

  it("is drawn only in the weeks it is held when it is fortnightly", async () => {
    calendar([fortnightly]);
    await screen.findByText("19 – 25 октября 2026");
    expect(screen.queryByText("Ревью с клиентом")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Следующая неделя" }));

    expect(await within(await day(/среда, 28 октября/)).findByText("Ревью с клиентом")).toBeInTheDocument();
    expect(screen.getAllByText("Ревью с клиентом")).toHaveLength(1);
  });

  it("is not drawn before its due date", async () => {
    calendar([{ ...standUp, dueDate: "2026-10-22" }]);

    expect(await within(await day(/четверг/)).findByText("Планёрка")).toBeInTheDocument();
    expect(within(await day(/понедельник/)).queryByText("Планёрка")).not.toBeInTheDocument();
    expect(within(await day(/среда/)).queryByText("Планёрка")).not.toBeInTheDocument();
  });

  it("is dragged on its due day, opened from the days it recurs, and never ticked", async () => {
    const opened: Task[] = [];
    calendar([standUp], (task) => opened.push(task));

    const monday = await day(/понедельник/);
    expect(await within(monday).findByRole("button", { name: "Открыть задачу: Планёрка" }))
      .toHaveAttribute("data-draggable", "true");
    const friday = within(await day(/пятница/)).getByRole("button", { name: "Открыть задачу: Планёрка" });
    expect(friday).not.toHaveAttribute("data-draggable");
    expect(screen.queryByRole("checkbox", { name: "Готово: Планёрка" })).not.toBeInTheDocument();

    await userEvent.click(friday);
    expect(opened).toEqual([standUp]);
  });

  it("recurs whatever stage it was left in", async () => {
    calendar([{ ...standUp, column: "ARCHIVED" }]);

    expect(await screen.findAllByText("Планёрка")).toHaveLength(7);
  });

  it("is marked as a call", async () => {
    calendar([{ ...standUp, endTime: "11:00" }]);

    expect(await within(await day(/вторник/)).findByLabelText("Созвон")).toBeInTheDocument();
  });
});

describe("a repeating task that is not a call", () => {
  it("is drawn on its due day alone", async () => {
    calendar([{ ...standUp, isCall: false }]);

    expect(await within(await day(/понедельник/)).findByText("Планёрка")).toBeInTheDocument();
    expect(screen.getAllByText("Планёрка")).toHaveLength(1);
  });
});
