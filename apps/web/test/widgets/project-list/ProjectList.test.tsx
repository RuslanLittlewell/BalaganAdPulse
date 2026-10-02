import { http as mock, HttpResponse } from "msw";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Routes, Route } from "react-router-dom";
import { server } from "@test/shared/index.js";
import { renderWithProviders } from "@test/shared/index.js";
import { aClient, aProject } from "@test/shared/index.js";
import { ProjectList } from "@/widgets/project-list/ProjectList.js";

function setup(route = "/") {
  return renderWithProviders(
    <Routes>
      <Route path="*" element={<ProjectList />} />
    </Routes>,
    { route },
  );
}

describe("ProjectList", () => {
  it("renders projects from the API", async () => {
    server.use(
      mock.get("/api/clients", () => HttpResponse.json([aClient({ name: "Acme" })])),
      mock.get("/api/projects", () => HttpResponse.json([aProject({ name: "Летний запуск" })])),
    );
    setup();
    expect(await screen.findByText("Летний запуск")).toBeInTheDocument();
    expect(screen.getByText("Acme")).toBeInTheDocument();
  });

  it("shows an empty state when there are no projects", async () => {
    server.use(mock.get("/api/projects", () => HttpResponse.json([])));
    setup();
    expect(await screen.findByRole("button", { name: /Новый проект/ })).toBeInTheDocument();
  });

  it("shows an error state with a retry button on failure", async () => {
    server.use(mock.get("/api/projects", () => HttpResponse.json({ error: { message: "boom" } }, { status: 500 })));
    setup();
    expect(await screen.findByRole("button", { name: "Повторить" })).toBeInTheDocument();
  });

  it("opens the new-project dialog", async () => {
    server.use(mock.get("/api/projects", () => HttpResponse.json([])));
    setup();
    await userEvent.click(await screen.findByRole("button", { name: /Новый проект/ }));
    await waitFor(() => expect(screen.getByLabelText("Название проекта")).toBeInTheDocument());
  });

  it("keeps the member's own order rather than sorting by priority", async () => {
    server.use(mock.get("/api/projects", () => HttpResponse.json([
      aProject({ id: "new", name: "Новый", priority: "NEW" }),
      aProject({ id: "critical", name: "Критичный", priority: "CRITICAL" }),
      aProject({ id: "idle", name: "Без задач", priority: "IDLE" }),
    ])));
    setup();

    await screen.findByText("Критичный");
    expect(screen.getAllByTestId(/^project-row-/).map((row) => row.getAttribute("data-testid")))
      .toEqual(["project-row-new", "project-row-critical", "project-row-idle"]);
  });

  it("offers an icon-only new-project button", async () => {
    server.use(mock.get("/api/projects", () => HttpResponse.json([])));
    setup();

    const button = await screen.findByRole("button", { name: "Новый проект" });
    expect(button).toHaveTextContent("");
  });

  it("uses the shared loader while the projects load", () => {
    setup();
    expect(screen.getAllByRole("status").map((node) => node.textContent)).toContain("Загрузка…");
  });

  it("puts an edit control on every row", async () => {
    server.use(
      mock.get("/api/clients", () => HttpResponse.json([aClient({ name: "Acme" })])),
      mock.get("/api/projects", () => HttpResponse.json([aProject({ name: "Летний запуск" })])),
    );
    setup();

    expect(await screen.findByRole("button", { name: "Редактировать: Летний запуск" }))
      .toBeInTheDocument();
  });

  it("opens the project for editing from that control, prefilled", async () => {
    server.use(
      mock.get("/api/clients", () => HttpResponse.json([aClient({ id: "1", name: "Acme" })])),
      mock.get("/api/projects", () =>
        HttpResponse.json([aProject({ clientId: "1", name: "Летний запуск" })])),
    );
    setup();

    await userEvent.click(await screen.findByRole("button", { name: "Редактировать: Летний запуск" }));

    expect(await screen.findByRole("dialog", { name: "Редактирование проекта" })).toBeInTheDocument();
    expect(screen.getByLabelText("Название проекта")).toHaveValue("Летний запуск");
  });

  it("keeps the row itself navigating, not editing", async () => {
    server.use(
      mock.get("/api/clients", () => HttpResponse.json([aClient({ name: "Acme" })])),
      mock.get("/api/projects", () => HttpResponse.json([aProject({ name: "Летний запуск" })])),
    );
    setup();

    await userEvent.click(await screen.findByText("Летний запуск"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("places that control after the label, at the trailing end of the row", async () => {
    server.use(
      mock.get("/api/clients", () => HttpResponse.json([aClient({ name: "Acme" })])),
      mock.get("/api/projects", () => HttpResponse.json([aProject({ name: "Летний запуск" })])),
    );
    setup();

    const edit = await screen.findByRole("button", { name: "Редактировать: Летний запуск" });
    const label = screen.getByText("Летний запуск");
    expect(label.compareDocumentPosition(edit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("marks the open project, though it is rendered beside that route and not inside it", async () => {
    server.use(
      mock.get("/api/clients", () => HttpResponse.json([aClient({ name: "Acme" })])),
      mock.get("/api/projects", () =>
        HttpResponse.json([aProject({ id: "p1", name: "Летний запуск" })])),
    );
    setup("/projects/p1/campaigns/c1");

    await screen.findByText("Летний запуск");
    expect(screen.getByText("Летний запуск").closest("[data-selected]"))
      .toHaveAttribute("data-selected", "true");
  });

  it("does not navigate when the open project is clicked again", async () => {
    server.use(
      mock.get("/api/clients", () => HttpResponse.json([aClient({ name: "Acme" })])),
      mock.get("/api/projects", () =>
        HttpResponse.json([aProject({ id: "p1", name: "Летний запуск" })])),
    );
    setup("/projects/p1");

    const row = await screen.findByText("Летний запуск");
    await userEvent.click(row);

    expect(screen.getByText("Летний запуск")).toBe(row);
  });

  it("marks a row with the colour of its priority", async () => {
    server.use(
      mock.get("/api/clients", () => HttpResponse.json([aClient({ name: "Acme" })])),
      mock.get("/api/projects", () =>
        HttpResponse.json([aProject({ name: "Летний запуск", priority: "CRITICAL" })])),
    );
    setup();

    expect(await screen.findByText("Приоритет: Очень важно")).toBeInTheDocument();
  });

  it("offers every priority on a right click", async () => {
    server.use(
      mock.get("/api/clients", () => HttpResponse.json([aClient({ name: "Acme" })])),
      mock.get("/api/projects", () => HttpResponse.json([aProject({ name: "Летний запуск" })])),
    );
    setup();

    fireEvent.contextMenu(await screen.findByText("Летний запуск"));

    const items = await screen.findAllByRole("menuitemradio");
    expect(items.map((item) => item.textContent)).toEqual([
      "Очень важно",
      "Есть срочные задачи",
      "В работе, ждём результата",
      "Нет задач",
      "Новый",
    ]);
  });

  it("shows which priority is the current one", async () => {
    server.use(
      mock.get("/api/clients", () => HttpResponse.json([aClient({ name: "Acme" })])),
      mock.get("/api/projects", () =>
        HttpResponse.json([aProject({ name: "Летний запуск", priority: "IDLE" })])),
    );
    setup();

    fireEvent.contextMenu(await screen.findByText("Летний запуск"));

    expect(await screen.findByRole("menuitemradio", { name: "Нет задач" }))
      .toHaveAttribute("aria-checked", "true");
  });

  it("saves the chosen priority", async () => {
    let sent: Record<string, unknown> | undefined;
    server.use(
      mock.get("/api/clients", () => HttpResponse.json([aClient({ name: "Acme" })])),
      mock.get("/api/projects", () =>
        HttpResponse.json([aProject({ id: "p1", name: "Летний запуск" })])),
      mock.patch("/api/projects/p1", async ({ request }) => {
        sent = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(aProject({ id: "p1", priority: "URGENT" }));
      }),
    );
    setup();

    fireEvent.contextMenu(await screen.findByText("Летний запуск"));
    await userEvent.click(await screen.findByRole("menuitemradio", { name: "Есть срочные задачи" }));

    await waitFor(() => expect(sent).toEqual({ priority: "URGENT" }));
  });
});

describe("a customer's project list", () => {
  const asCustomer = (role = "CLIENT", clientIds = ["1"]) => {
    server.use(mock.get("/api/auth/me", () => HttpResponse.json({
      user: { id: "user-9", name: "Клиент", email: "client@acme.com", image: null },
      organization: { id: "org-1", name: "AdPulse", slug: "adpulse" },
      role,
      clientIds,
    })));
  };

  it("offers the create control and the edit action but no priority menu", async () => {
    asCustomer();
    server.use(
      mock.get("/api/clients", () => HttpResponse.json([aClient({ id: "1", name: "Acme" })])),
      mock.get("/api/projects", () => HttpResponse.json([aProject({ clientId: "1", name: "Летний запуск" })])),
    );
    setup();

    expect(await screen.findByRole("button", { name: "Новый проект" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Редактировать: Летний запуск" })).toBeInTheDocument();
    fireEvent.contextMenu(screen.getByText("Летний запуск"));
    expect(await screen.findByRole("menuitem", { name: "Закрепить" })).toBeInTheDocument();
    expect(screen.queryAllByRole("menuitemradio")).toEqual([]);
  });
});

describe("searching the project list", () => {
  const withProjects = () => server.use(
    mock.get("/api/clients", () => HttpResponse.json([
      aClient({ id: "1", name: "Acme" }),
      aClient({ id: "2", name: "Стоматология Улыбка" }),
    ])),
    mock.get("/api/projects", () => HttpResponse.json([
      aProject({ id: "summer", clientId: "1", name: "Летний запуск", priority: "CRITICAL" }),
      aProject({ id: "autumn", clientId: "1", name: "Осенняя распродажа", priority: "IDLE" }),
      aProject({ id: "implants", clientId: "2", name: "Имплантация", priority: "NEW" }),
    ])),
  );
  const searchField = () => screen.getByRole("searchbox", { name: "Поиск проектов" });

  it("offers a search field and no priority filter", async () => {
    withProjects();
    setup();
    await screen.findByText("Летний запуск");

    expect(searchField()).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Фильтр по приоритету" })).toBeNull();
  });

  it("narrows to the projects whose name matches, in any case, once typing pauses", async () => {
    const user = userEvent.setup();
    withProjects();
    setup();
    await screen.findByText("Летний запуск");

    await user.type(searchField(), "  ЛЕТН ");
    expect(screen.getByText("Осенняя распродажа")).toBeInTheDocument();

    await waitFor(() => expect(screen.queryByText("Осенняя распродажа")).toBeNull());
    expect(screen.getByText("Летний запуск")).toBeInTheDocument();
    expect(screen.queryByText("Имплантация")).toBeNull();
  });

  it("finds a client's projects by the client's name", async () => {
    const user = userEvent.setup();
    withProjects();
    setup();
    await screen.findByText("Летний запуск");

    await user.type(searchField(), "улыбка");

    await waitFor(() => expect(screen.queryByText("Летний запуск")).toBeNull());
    expect(screen.getByText("Имплантация")).toBeInTheDocument();
  });

  it("says so when nothing matches", async () => {
    const user = userEvent.setup();
    withProjects();
    setup();
    await screen.findByText("Летний запуск");

    await user.type(searchField(), "нет такого");

    expect(await screen.findByText("Ничего не найдено")).toBeInTheDocument();
  });

  it("stops dragging while searching and brings back the whole list when cleared", async () => {
    const user = userEvent.setup();
    withProjects();
    setup();
    await screen.findByText("Летний запуск");
    expect(screen.getByTestId("project-row-summer")).toHaveAttribute("data-draggable", "true");

    await user.type(searchField(), "летн");
    await waitFor(() => expect(screen.queryByText("Имплантация")).toBeNull());
    expect(screen.getByTestId("project-row-summer")).toHaveAttribute("data-draggable", "false");

    await user.clear(searchField());
    expect(await screen.findByText("Имплантация")).toBeInTheDocument();
    expect(screen.getByTestId("project-row-summer")).toHaveAttribute("data-draggable", "true");
  });
});
