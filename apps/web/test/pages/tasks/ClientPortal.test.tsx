import { http as mock, HttpResponse } from "msw";
import { screen, within } from "@testing-library/react";
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
      .toEqual(["Дашборд", "Проекты", "Задачи"]);
  });

  it("still shows every module to the agency", async () => {
    renderWithProviders(
      <Routes><Route path="*" element={<MainNav />} /></Routes>,
      { route: "/" },
    );

    const nav = screen.getByRole("navigation", { name: "Разделы" });
    expect(within(nav).getAllByRole("link")).toHaveLength(5);
  });

  it("lists the tasks marked as shown to them", async () => {
    asClient();
    renderWithProviders(<TasksPage />, { route: "/tasks" });

    expect(await screen.findByText("Поменяйте баннер")).toBeInTheDocument();
  });

  it("opens a task read-only rather than in the edit form", async () => {
    const user = userEvent.setup();
    asClient();
    renderWithProviders(<TasksPage />, { route: "/tasks" });

    await user.click(await screen.findByText("Поменяйте баннер"));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByRole("button", { name: "Сохранить" })).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Название")).not.toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "Поменяйте баннер" })).toBeInTheDocument();
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
