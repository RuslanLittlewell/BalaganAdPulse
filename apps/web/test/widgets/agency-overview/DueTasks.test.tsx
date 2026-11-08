import { http as mock, HttpResponse } from "msw";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes, useLocation } from "react-router-dom";
import { aTask, renderWithProviders, server } from "@test/shared/index.js";
import { DueTasks } from "@/widgets/agency-overview/DueTasks.js";

const dayFrom = (offset: number) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return new Intl.DateTimeFormat("sv-SE").format(date);
};

function TasksDestination() {
  return <output>{useLocation().search}</output>;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<DueTasks />} />
      <Route path="/tasks" element={<TasksDestination />} />
    </Routes>
  );
}

const mine = (overrides: Parameters<typeof aTask>[0]) => aTask({ participantIds: ["member-1"], column: "IN_PROGRESS", dueTime: null, endTime: null, ...overrides });

describe("the due tasks block", () => {
  it("lists my tasks that are overdue, due today or due soon, with their labels", async () => {
    server.use(mock.get("/api/tasks", () => HttpResponse.json([
      mine({ id: "t1", title: "Отчёт клиенту", dueDate: dayFrom(0), dueTime: "15:00", endTime: "17:30" }),
      mine({ id: "t2", title: "Старый долг", dueDate: dayFrom(-2) }),
      mine({ id: "t3", title: "Правки макета", dueDate: dayFrom(1) }),
      mine({ id: "t4", title: "Далёкая задача", dueDate: dayFrom(5) }),
      aTask({ id: "t5", title: "Чужая задача", participantIds: ["someone"], column: "IN_PROGRESS", dueDate: dayFrom(0) }),
      aTask({ id: "t6", title: "Без исполнителя", createdById: "member-1", participantIds: [], column: "IN_PROGRESS", dueDate: dayFrom(-1) }),
    ])));
    renderWithProviders(<App />);

    const section = await screen.findByRole("region", { name: "Задачи на сегодня и ближайшие дни" });
    const items = await within(section).findAllByRole("link");
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining("Старый долг"),
      expect.stringContaining("Без исполнителя"),
      expect.stringContaining("Отчёт клиенту"),
      expect.stringContaining("Правки макета"),
    ]);
    expect(items[0]).toHaveTextContent("Просрочено");
    expect(items[2]).toHaveTextContent("Сегодня до 17:30");
    expect(items[3]).toHaveTextContent("Завтра");
    expect(items[2]!.querySelector("[data-priority]")).toHaveAttribute("data-priority", "MEDIUM");
    expect(within(section).queryByText("Далёкая задача")).toBeNull();
    expect(within(section).queryByText("Чужая задача")).toBeNull();
  });

  it("labels a task without an end time by its day alone", async () => {
    server.use(mock.get("/api/tasks", () => HttpResponse.json([
      mine({ id: "t1", title: "Без окончания", dueDate: dayFrom(0), dueTime: "15:00", endTime: null }),
    ])));
    renderWithProviders(<App />);

    const link = await screen.findByRole("link", { name: /Без окончания/ });
    expect(link).toHaveTextContent("Сегодня");
    expect(link).not.toHaveTextContent("15:00");
  });

  it("marks each task with its priority and names the priority for screen readers", async () => {
    server.use(mock.get("/api/tasks", () => HttpResponse.json([
      mine({ id: "t1", title: "Срочное", dueDate: dayFrom(0), priority: "URGENT" }),
      mine({ id: "t2", title: "Фоновое", dueDate: dayFrom(1), priority: "LOW" }),
    ])));
    renderWithProviders(<App />);

    const urgent = await screen.findByRole("link", { name: /Срочное/ });
    expect(urgent.querySelector("[data-priority]")).toHaveAttribute("data-priority", "URGENT");
    expect(urgent).toHaveAccessibleName(/Срочный/);
    expect(screen.getByRole("link", { name: /Фоновое/ }).querySelector("[data-priority]")).toHaveAttribute("data-priority", "LOW");
  });

  it("opens the task on the tasks screen", async () => {
    server.use(mock.get("/api/tasks", () => HttpResponse.json([mine({ id: "t1", title: "Отчёт клиенту", dueDate: dayFrom(0) })])));
    renderWithProviders(<App />);

    await userEvent.click(await screen.findByRole("link", { name: /Отчёт клиенту/ }));

    expect(await screen.findByText("?task=t1")).toBeInTheDocument();
  });

  it("shows a loader while the tasks load", async () => {
    server.use(mock.get("/api/tasks", async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      return HttpResponse.json([]);
    }));
    renderWithProviders(<App />);

    const section = await screen.findByRole("region", { name: "Задачи на сегодня и ближайшие дни" });
    expect(within(section).getByRole("status")).toHaveTextContent("Загружаем задачи");
    expect(await within(section).findByText("Срочных задач нет")).toBeInTheDocument();
  });

  it("says nothing is due", async () => {
    server.use(mock.get("/api/tasks", () => HttpResponse.json([])));
    renderWithProviders(<App />);

    expect(await screen.findByText("Срочных задач нет")).toBeInTheDocument();
  });

  it("says the tasks could not be read and offers a retry", async () => {
    let failing = true;
    server.use(mock.get("/api/tasks", () => (failing ? HttpResponse.json({ error: { message: "x" } }, { status: 500 }) : HttpResponse.json([]))));
    renderWithProviders(<App />);

    expect(await screen.findByText("Не удалось загрузить задачи.")).toBeInTheDocument();
    failing = false;
    await userEvent.click(screen.getByRole("button", { name: "Повторить" }));
    expect(await screen.findByText("Срочных задач нет")).toBeInTheDocument();
  });

  it("makes no task request and shows no list when the organization lacks the tasks module", async () => {
    let requested = false;
    server.use(
      mock.get("/api/auth/me", () => HttpResponse.json({
        user: { id: "user-1", name: "Buyer", email: "buyer@acme.com", login: null, image: null },
        platformAdmin: false,
        organization: { id: "org-1", name: "AdPulse", slug: "adpulse", status: "ACTIVE" },
        role: "ADMIN", membershipId: "member-1", clientIds: [], modules: ["DASHBOARD", "PROJECTS"],
        tariff: { tariff: "ENTERPRISE", trialEndsAt: null, trialExpired: false, limits: { projects: null, clients: null, users: null, adAccounts: null }, usage: { projects: 0, clients: 0, users: 1, adAccounts: 0 } },
      })),
      mock.get("/api/tasks", () => { requested = true; return HttpResponse.json([]); }),
    );
    renderWithProviders(<App />);

    await screen.findByRole("status").catch(() => null);
    expect(screen.queryByRole("region", { name: "Задачи на сегодня и ближайшие дни" })).toBeNull();
    expect(requested).toBe(false);
  });
});
