import { http as mock, HttpResponse } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { aProject, aTask, renderWithProviders, server } from "@test/shared/index.js";
import { TasksPage } from "@/pages/tasks/index.js";
import { MainNav } from "@/widgets/main-nav/MainNav.js";

function asClient() {
  server.use(mock.get("/api/auth/me", () => HttpResponse.json({
    user: { id: "u1", name: "Иван", email: "ivan@clinic.by", image: null },
    organization: { id: "org-1", name: "AdPulse", slug: "adpulse" },
    role: "CLIENT",
    clientIds: ["client-1"],
    modules: ["DASHBOARD", "PROJECTS", "CRM", "TASKS", "REPORTS"],
  })));
}

beforeEach(() => {
  server.use(
    mock.get("/api/projects", () => HttpResponse.json([aProject({ id: "project-1" })])),
    mock.get("/api/members", () => HttpResponse.json([])),
    mock.get("/api/tasks", () => HttpResponse.json([
      aTask({ id: "t1", projectId: "project-1", title: "Поменяйте баннер", visibleToClient: true }),
    ])),
  );
});

describe("what a client is offered", () => {
  it("shows only the modules their role reads", async () => {
    asClient();
    renderWithProviders(
      <Routes><Route path="*" element={<MainNav />} /></Routes>,
      { route: "/" },
    );

    const nav = await screen.findByRole("navigation", { name: "Разделы" });
    await screen.findByRole("link", { name: "Задачи" });
    expect(within(nav).getAllByRole("link").map((link) => link.textContent))
      .toEqual(["Дашборд", "CRM", "Проекты", "Задачи", "Отчёты"]);
  });

  it("still shows every module to the agency", async () => {
    renderWithProviders(
      <Routes><Route path="*" element={<MainNav />} /></Routes>,
      { route: "/" },
    );

    const nav = screen.getByRole("navigation", { name: "Разделы" });
    await waitFor(() => expect(within(nav).getAllByRole("link")).toHaveLength(6));
  });

  it("lists the tasks marked as shown to them", async () => {
    asClient();
    renderWithProviders(<TasksPage />, { route: "/tasks" });

    expect(await screen.findByText("Поменяйте баннер")).toBeInTheDocument();
  });

  it("opens a task on a project in the agency's form, to read and not to change", async () => {
    const user = userEvent.setup();
    asClient();
    renderWithProviders(<TasksPage />, { route: "/tasks" });

    await user.click(await screen.findByText("Поменяйте баннер"));

    const dialog = await screen.findByRole("dialog", { name: "Задача" });
    expect(within(dialog).getByLabelText("Название")).toHaveValue("Поменяйте баннер");
    expect(within(dialog).getByLabelText("Название")).toHaveAttribute("readonly");
    expect(within(dialog).getByLabelText("Этап")).toBeDisabled();
    expect(within(dialog).getByLabelText("Приоритет")).toBeDisabled();
    expect(within(dialog).queryByRole("button", { name: "Сохранить" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Удалить" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("switch", { name: "Видно клиенту" })).not.toBeInTheDocument();
    expect(within(within(dialog).getByTestId("task-form-footer")).getByRole("button", { name: "Закрыть" })).toBeInTheDocument();
    expect(await within(dialog).findByRole("textbox", { name: "Текст комментария" })).toBeEnabled();
  });

  it("offers no Готово on a task on a project", async () => {
    asClient();
    renderWithProviders(<TasksPage />, { route: "/tasks" });

    expect(await screen.findByText("Поменяйте баннер")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /Поменяйте баннер/ })).not.toBeInTheDocument();
  });

  it("still lets them raise one", async () => {
    asClient();
    renderWithProviders(<TasksPage />, { route: "/tasks" });

    expect(await screen.findByRole("button", { name: "Новая задача" })).toBeInTheDocument();
  });

  it("opens the edit form for the agency", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TasksPage />, { route: "/tasks" });

    await user.click(await screen.findByText("Поменяйте баннер"));

    expect(await screen.findByLabelText("Название")).toBeInTheDocument();
  });
});

describe("a client's personal task", () => {
  const personal = aTask({ id: "t2", projectId: null, title: "Позвонить бухгалтеру", personal: true });

  beforeEach(() => {
    server.use(mock.get("/api/tasks", () => HttpResponse.json([
      aTask({ id: "t1", projectId: "project-1", title: "Поменяйте баннер", visibleToClient: true }),
      personal,
    ])));
  });

  it("tells a client raising a task without a project that only they see it", async () => {
    const user = userEvent.setup();
    let sent: Record<string, unknown> | null = null;
    server.use(mock.post("/api/tasks", async ({ request }) => {
      sent = await request.json() as Record<string, unknown>;
      return HttpResponse.json(aTask({ ...sent, id: "t3", personal: true }), { status: 201 });
    }));
    asClient();
    renderWithProviders(<TasksPage />, { route: "/tasks" });

    await user.click(await screen.findByRole("button", { name: "Новая задача" }));
    const dialog = await screen.findByRole("dialog", { name: "Новая задача" });
    expect(within(dialog).getByText("Задачу без проекта видите только вы")).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("Название"), "Купить бумагу");
    await user.click(within(dialog).getByRole("button", { name: "Создать задачу" }));

    await waitFor(() => expect(sent).toMatchObject({ projectId: null, title: "Купить бумагу" }));
  });

  it("opens it for editing, with a way to delete it", async () => {
    const user = userEvent.setup();
    let sent: Record<string, unknown> | null = null;
    server.use(mock.patch("/api/tasks/t2", async ({ request }) => {
      sent = await request.json() as Record<string, unknown>;
      return HttpResponse.json({ ...personal, ...sent });
    }));
    asClient();
    renderWithProviders(<TasksPage />, { route: "/tasks" });

    await user.click(await screen.findByText("Позвонить бухгалтеру"));
    const dialog = await screen.findByRole("dialog", { name: "Редактировать" });
    expect(within(dialog).getByLabelText("Этап")).toBeEnabled();
    expect(within(dialog).getByRole("button", { name: "Удалить" })).toBeInTheDocument();
    await user.clear(within(dialog).getByLabelText("Название"));
    await user.type(within(dialog).getByLabelText("Название"), "Позвонить в налоговую");
    await user.click(within(dialog).getByRole("button", { name: "Сохранить" }));

    await waitFor(() => expect(sent).toMatchObject({ title: "Позвонить в налоговую", projectId: null }));
    expect(sent).not.toHaveProperty("visibleToClient");
    expect(sent).not.toHaveProperty("participantIds");
  });

  it("closes it from its card", async () => {
    const user = userEvent.setup();
    let moved: unknown = null;
    server.use(mock.post("/api/tasks/t2/move", async ({ request }) => {
      moved = await request.json();
      return HttpResponse.json({ ...personal, column: "DONE", position: 0 });
    }));
    asClient();
    renderWithProviders(<TasksPage />, { route: "/tasks" });

    await user.click(await screen.findByRole("checkbox", { name: /Позвонить бухгалтеру/ }));

    await waitFor(() => expect(moved).toEqual({ column: "DONE", position: 0 }));
  });
});
