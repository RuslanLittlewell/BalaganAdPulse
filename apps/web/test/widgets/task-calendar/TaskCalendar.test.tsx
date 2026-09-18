import { http as mock, HttpResponse } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Routes, Route } from "react-router-dom";
import { aTask, renderWithProviders, server } from "@test/shared/index.js";
import { LoadedTaskCalendar as TaskCalendar } from "@test/shared/task-widgets.js";

const TODAY = "2026-09-17";

function calendar(tasks: unknown[] = []) {
  server.use(mock.get("/api/tasks", () => HttpResponse.json(tasks)));
  return renderWithProviders(
    <Routes><Route path="*" element={<TaskCalendar today={TODAY} />} /></Routes>,
    { route: "/tasks" },
  );
}

const DAYS = ["понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье"];

describe("the week the calendar shows", () => {
  it("opens on the week that holds today", async () => {
    calendar();
    expect(await screen.findByText("14 – 20 сентября 2026")).toBeInTheDocument();
  });

  it("draws seven days, Monday to Sunday", async () => {
    calendar();
    const columns = await screen.findAllByRole("group");
    expect(columns).toHaveLength(7);
    expect(columns.map((column) => column.getAttribute("aria-label")?.split(",")[0]))
      .toEqual(DAYS);
  });

  it("marks today", async () => {
    calendar();
    const columns = await screen.findAllByRole("group");
    expect(columns.filter((column) => column.dataset.today === "true")).toHaveLength(1);
    expect(columns[3]!.dataset.today).toBe("true");
  });

  it("goes to the next week and back to the previous one", async () => {
    calendar();
    await userEvent.click(await screen.findByRole("button", { name: "Следующая неделя" }));
    expect(await screen.findByText("21 – 27 сентября 2026")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Предыдущая неделя" }));
    expect(await screen.findByText("14 – 20 сентября 2026")).toBeInTheDocument();
  });

  it("marks no day as today in another week", async () => {
    calendar();
    await userEvent.click(await screen.findByRole("button", { name: "Следующая неделя" }));
    await screen.findByText("21 – 27 сентября 2026");

    const columns = screen.getAllByRole("group");
    expect(columns.some((column) => column.dataset.today === "true")).toBe(false);
  });

  it("comes back to the week that holds today", async () => {
    calendar();
    const forward = await screen.findByRole("button", { name: "Следующая неделя" });
    await userEvent.click(forward);
    await userEvent.click(forward);
    await userEvent.click(forward);
    await screen.findByText("5 – 11 октября 2026");

    await userEvent.click(screen.getByRole("button", { name: "Сегодня" }));
    expect(await screen.findByText("14 – 20 сентября 2026")).toBeInTheDocument();
  });
});

describe("who may move a card between days", () => {
  it("lets a member who may write drag a card", async () => {
    calendar([aTask({ dueDate: "2026-09-16" })]);
    const card = await screen.findByTestId("task-card-task-1");
    expect(card).toHaveAttribute("data-draggable", "true");
  });

  it("does not let a guest drag a card, but still lets them open it", async () => {
    server.use(mock.get("/api/auth/me", () => HttpResponse.json({
      user: { id: "user-1", name: "Guest", email: "g@acme.com", image: null },
      organization: { id: "org-1", name: "AdPulse", slug: "adpulse" },
      role: "GUEST",
      clientIds: [],
    })));
    calendar([aTask({ title: "Только чтение", dueDate: "2026-09-16" })]);

    const card = await screen.findByTestId("task-card-task-1");
    await waitFor(() => expect(card).not.toHaveAttribute("data-draggable"));
    expect(screen.queryByTestId("task-drag-task-1")).not.toBeInTheDocument();
    expect(card).toHaveAttribute("role", "button");
  });
});

describe("what the calendar holds", () => {
  it("shows a task on the day it is due", async () => {
    calendar([aTask({ title: "Созвон", dueDate: "2026-09-16" })]);
    const wednesday = await screen.findByRole("group", { name: /среда/ });
    expect(within(wednesday).getByText("Созвон")).toBeInTheDocument();
  });

  it("holds no task that has no due date", async () => {
    calendar([aTask({ title: "Без срока" })]);
    await screen.findByText("14 – 20 сентября 2026");
    expect(screen.queryByText("Без срока")).not.toBeInTheDocument();
  });

  it("holds no task due in another week", async () => {
    calendar([aTask({ title: "На той неделе", dueDate: "2026-09-25" })]);
    await screen.findByText("14 – 20 сентября 2026");
    expect(screen.queryByText("На той неделе")).not.toBeInTheDocument();
  });

  it("draws an empty day in its place", async () => {
    calendar([aTask({ dueDate: "2026-09-16" })]);
    const sunday = await screen.findByRole("group", { name: /воскресенье/ });
    expect(within(sunday).queryByRole("button", { name: /Открыть задачу/ })).not.toBeInTheDocument();
  });

  it("puts the timed tasks first, earliest first, then those with no time", async () => {
    calendar([
      aTask({ id: "a", title: "Без времени", dueDate: "2026-09-16", position: 0 }),
      aTask({ id: "b", title: "Днём", dueDate: "2026-09-16", dueTime: "15:00", position: 1 }),
      aTask({ id: "c", title: "Утром", dueDate: "2026-09-16", dueTime: "09:30", position: 2 }),
    ]);

    const wednesday = await screen.findByRole("group", { name: /среда/ });
    const titles = [...wednesday.querySelectorAll("article h3")].map((node) => node.textContent);
    expect(titles).toEqual(["Утром", "Днём", "Без времени"]);
  });
});
