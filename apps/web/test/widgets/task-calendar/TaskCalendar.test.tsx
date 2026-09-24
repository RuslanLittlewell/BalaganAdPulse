import { http as mock, HttpResponse } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Routes, Route } from "react-router-dom";
import { aProject, aTask, renderWithProviders, server } from "@test/shared/index.js";
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

describe("zooming the hour grid", () => {
  const grid = () => screen.getByTestId("calendar-grid");
  const zoomOut = () => screen.getByRole("button", { name: "Уменьшить масштаб" });
  const zoomIn = () => screen.getByRole("button", { name: "Увеличить масштаб" });

  it("opens at the largest scale, with only zooming out available", async () => {
    calendar();
    await screen.findByText("14 – 20 сентября 2026");

    expect(grid()).toHaveAttribute("data-zoom", "4");
    expect(zoomIn()).toBeDisabled();
    expect(zoomOut()).toBeEnabled();
  });

  it("steps down to the smallest scale and back up", async () => {
    calendar();
    await screen.findByText("14 – 20 сентября 2026");

    for (let step = 0; step < 4; step++) await userEvent.click(zoomOut());
    expect(grid()).toHaveAttribute("data-zoom", "0");
    expect(zoomOut()).toBeDisabled();
    expect(zoomIn()).toBeEnabled();

    await userEvent.click(zoomIn());
    expect(grid()).toHaveAttribute("data-zoom", "1");
  });

  it("remembers the chosen scale when the calendar opens again", async () => {
    const first = calendar();
    await screen.findByText("14 – 20 сентября 2026");
    await userEvent.click(zoomOut());
    await userEvent.click(zoomOut());
    first.unmount();

    calendar();
    await screen.findByText("14 – 20 сентября 2026");
    expect(grid()).toHaveAttribute("data-zoom", "2");
  });

  it("shows compact cards, title and time only, at the smallest scale", async () => {
    calendar([aTask({ id: "timed", title: "Созвон", dueDate: TODAY, dueTime: "10:00", checklist: [{ id: "c1", title: "Пункт", done: false, position: 0 }] })]);
    const card = await screen.findByTestId("task-card-timed");
    expect(card).not.toHaveAttribute("data-compact");
    expect(within(card).getByText("0/1")).toBeInTheDocument();

    for (let step = 0; step < 4; step++) await userEvent.click(zoomOut());

    const compact = screen.getByTestId("task-card-timed");
    expect(compact).toHaveAttribute("data-compact", "true");
    expect(within(compact).getByText("Созвон")).toBeInTheDocument();
    expect(within(compact).getByText("10:00")).toBeInTheDocument();
    expect(within(compact).queryByText("0/1")).not.toBeInTheDocument();
  });
});

describe("the assignee on a calendar card", () => {
  it("names the assignee in a tooltip when their picture is hovered", async () => {
    server.use(mock.get("/api/members", () => HttpResponse.json([{
      id: "member-1", userId: "user-1", name: "Мария", email: "maria@example.com",
      image: null, phone: null, telegram: null, role: "MANAGER", status: "ACTIVE",
      createdAt: "2026-09-05T00:00:00.000Z",
    }])));
    calendar([aTask({ id: "assigned", title: "Созвон", dueDate: TODAY, dueTime: "10:00", assigneeId: "member-1" })]);

    await userEvent.hover(await screen.findByTestId("task-assignee-assigned"));

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Мария");
  });
});

describe("the details of a compact card", () => {
  function staffed() {
    server.use(
      mock.get("/api/members", () => HttpResponse.json([{
        id: "member-1", userId: "user-1", name: "Мария", email: "maria@example.com",
        image: null, phone: null, telegram: null, role: "MANAGER", status: "ACTIVE",
        createdAt: "2026-09-05T00:00:00.000Z",
      }])),
      mock.get("/api/projects", () => HttpResponse.json([aProject({ id: "project-1", name: "Сайт" })])),
    );
    calendar([aTask({ id: "busy", title: "Созвон с клиентом", dueDate: TODAY, dueTime: "10:00", projectId: "project-1", assigneeId: "member-1" })]);
  }

  it("tells the title, time, project and assignee on hover", async () => {
    staffed();
    await screen.findByTestId("task-card-busy");
    for (let step = 0; step < 4; step++) await userEvent.click(screen.getByRole("button", { name: "Уменьшить масштаб" }));

    await userEvent.hover(screen.getByTestId("task-card-busy"));

    const tooltip = await screen.findByRole("tooltip");
    for (const text of ["Созвон с клиентом", "10:00", "Сайт", "Мария"]) expect(tooltip).toHaveTextContent(text);
  });

  it("shows no details tooltip for a full-size card", async () => {
    staffed();
    const card = await screen.findByTestId("task-card-busy");

    await userEvent.hover(within(card).getByText("Созвон с клиентом"));

    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});
