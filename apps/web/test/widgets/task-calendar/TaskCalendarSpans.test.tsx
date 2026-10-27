import { http as mock, HttpResponse } from "msw";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Routes, Route } from "react-router-dom";
import { aTask, renderWithProviders, server } from "@test/shared/index.js";
import { LoadedTaskCalendar as TaskCalendar } from "@test/shared/task-widgets.js";
import { CALENDAR_HOUR_HEIGHT, CALENDAR_START_HOUR } from "@/widgets/task-calendar/index.js";

const TODAY = "2026-09-17";
const WEEK = ["2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18", "2026-09-19", "2026-09-20"];
const COLUMN_WIDTH = 100;

function calendar(tasks: unknown[], onOpen?: (task: { id: string }) => void) {
  server.use(mock.get("/api/tasks", () => HttpResponse.json(tasks)));
  return renderWithProviders(
    <Routes><Route path="*" element={<TaskCalendar today={TODAY} onOpen={onOpen} />} /></Routes>,
    { route: "/tasks" },
  );
}

const lineOf = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number) as [number, number];
  return ((hours - CALENDAR_START_HOUR + 24) % 24 + minutes / 60) * CALENDAR_HOUR_HEIGHT;
};

function measureColumns() {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const index = WEEK.indexOf(this.dataset.calendarColumn ?? "");
    const left = index < 0 ? 0 : index * COLUMN_WIDTH;
    const width = index < 0 ? 0 : COLUMN_WIDTH;
    const height = index < 0 ? 0 : 24 * CALENDAR_HOUR_HEIGHT;
    return { left, right: left + width, top: 0, bottom: height, width, height, x: left, y: 0, toJSON: () => ({}) } as DOMRect;
  });
}

function drag(card: HTMLElement, day: string, time: string) {
  fireEvent.mouseDown(card, { button: 0, clientX: 1, clientY: 0 });
  fireEvent.mouseMove(document, { clientX: WEEK.indexOf(day) * COLUMN_WIDTH + 50, clientY: lineOf(time) });
  fireEvent.mouseUp(document);
}

afterEach(() => vi.restoreAllMocks());

describe("tasks that share their time", () => {
  it("are drawn side by side, and each can be opened", async () => {
    const opened: string[] = [];
    calendar([
      aTask({ id: "a", title: "Первый", dueDate: "2026-09-16", dueTime: "12:00", endTime: "13:00" }),
      aTask({ id: "b", title: "Второй", dueDate: "2026-09-16", dueTime: "12:00", endTime: "13:00" }),
    ], (task) => opened.push(task.id));

    const first = await screen.findByTestId("task-card-a");
    const second = screen.getByTestId("task-card-b");
    expect(first).toHaveAttribute("data-lanes", "2");
    expect(second).toHaveAttribute("data-lanes", "2");
    expect([first.dataset.lane, second.dataset.lane].sort()).toEqual(["0", "1"]);

    first.focus();
    await userEvent.keyboard("{Enter}");
    second.focus();
    await userEvent.keyboard("{Enter}");
    expect(opened).toEqual(["a", "b"]);
  });

  it("are drawn at full width when one follows the other", async () => {
    calendar([
      aTask({ id: "a", dueDate: "2026-09-16", dueTime: "12:00", endTime: "13:00" }),
      aTask({ id: "b", dueDate: "2026-09-16", dueTime: "13:00", endTime: "14:00" }),
    ]);

    expect(await screen.findByTestId("task-card-a")).toHaveAttribute("data-lanes", "1");
    expect(screen.getByTestId("task-card-b")).toHaveAttribute("data-lanes", "1");
  });
});

describe("a card follows the length of its task", () => {
  it("shows a short call on one line beside an hour-long task's full card", async () => {
    calendar([
      aTask({ id: "call", title: "Созвон", dueDate: "2026-09-16", dueTime: "10:00", endTime: "10:15" }),
      aTask({
        id: "long", title: "Мастерская", dueDate: "2026-09-16", dueTime: "12:00", endTime: "13:00",
        checklist: [{ id: "c1", title: "Пункт", done: false, position: 0 }],
      }),
    ]);

    const call = await screen.findByTestId("task-card-call");
    const long = screen.getByTestId("task-card-long");
    expect(call).toHaveAttribute("data-compact", "true");
    expect(within(call).getByText("10:00–10:15")).toBeInTheDocument();
    expect(long).not.toHaveAttribute("data-compact");
    expect(within(long).getByText("0/1")).toBeInTheDocument();
  });
});

describe("dragging a short call", () => {
  it("moves it to the day and time it is dropped at", async () => {
    let sent: Record<string, unknown> | null = null;
    const call = aTask({
      id: "call", title: "Планёрка", dueDate: "2026-09-16", dueTime: "10:00", endTime: "10:15",
      repeatEvery: "DAILY", isCall: true,
    });
    server.use(mock.patch("/api/tasks/call", async ({ request }) => {
      sent = await request.json() as Record<string, unknown>;
      return HttpResponse.json({ ...call, dueDate: "2026-09-18", dueTime: "15:00", endTime: "15:15" });
    }));
    calendar([call]);
    const wednesday = await screen.findByRole("group", { name: /среда/ });
    const card = await within(wednesday).findByTestId("task-card-call");
    expect(card).toHaveAttribute("data-compact", "true");
    measureColumns();

    drag(card, "2026-09-18", "15:00");

    await waitFor(() => expect(sent).toEqual({ dueDate: "2026-09-18", dueTime: "15:00", timeZone: "Asia/Tokyo" }));
  });
});

describe("dragging a task that has an end", () => {
  it("keeps its length on another day", async () => {
    let sent: Record<string, unknown> | null = null;
    const task = aTask({ id: "a", title: "Встреча", dueDate: "2026-09-16", dueTime: "12:00", endTime: "13:30" });
    server.use(mock.patch("/api/tasks/a", async ({ request }) => {
      sent = await request.json() as Record<string, unknown>;
      return HttpResponse.json({ ...task, dueDate: "2026-09-18", dueTime: "15:00", endTime: "16:30" });
    }));
    calendar([task]);
    const card = await screen.findByTestId("task-card-a");
    measureColumns();

    drag(card, "2026-09-18", "15:00");

    await waitFor(() => expect(sent).toEqual({ dueDate: "2026-09-18", dueTime: "15:00", timeZone: "Asia/Tokyo" }));
    const friday = screen.getByRole("group", { name: /пятница/ });
    expect(await within(friday).findByText("15:00–16:30")).toBeInTheDocument();
  });

  it("is placed as late as the day allows when dropped too late for its length", async () => {
    let sent: Record<string, unknown> | null = null;
    const task = aTask({ id: "a", dueDate: "2026-09-16", dueTime: "12:00", endTime: "14:00" });
    server.use(mock.patch("/api/tasks/a", async ({ request }) => {
      sent = await request.json() as Record<string, unknown>;
      return HttpResponse.json({ ...task, dueTime: "22:00", endTime: "24:00" });
    }));
    calendar([task]);
    const card = await screen.findByTestId("task-card-a");
    measureColumns();

    drag(card, "2026-09-16", "23:00");

    await waitFor(() => expect(sent).toEqual({ dueDate: "2026-09-16", dueTime: "22:00", timeZone: "Asia/Tokyo" }));
  });
});
