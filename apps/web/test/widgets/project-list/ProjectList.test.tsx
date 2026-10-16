import { http as mock, HttpResponse } from "msw";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Routes, Route } from "react-router-dom";
import { server } from "@test/shared/index.js";
import { renderWithProviders } from "@test/shared/index.js";
import { aClient, aProject } from "@test/shared/index.js";
import { EMPTY_PERFORMANCE, type ProjectFigures } from "@/entities/campaign/index.js";
import { KpiTile } from "@/features/kpi-target/index.js";
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

  it("keeps the member's own order rather than sorting by KPI progress", async () => {
    server.use(mock.get("/api/projects", () => HttpResponse.json([
      aProject({ id: "new", name: "Новый" }),
      aProject({ id: "critical", name: "Критичный" }),
      aProject({ id: "idle", name: "Без задач" }),
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

  it("offers no priority on a right click", async () => {
    server.use(
      mock.get("/api/clients", () => HttpResponse.json([aClient({ name: "Acme" })])),
      mock.get("/api/projects", () => HttpResponse.json([aProject({ name: "Летний запуск" })])),
    );
    setup();

    fireEvent.contextMenu(await screen.findByText("Летний запуск"));

    expect(await screen.findByRole("menuitem", { name: "Закрепить" })).toBeInTheDocument();
    expect(screen.queryAllByRole("menuitemradio")).toEqual([]);
    expect(screen.queryByText("Приоритет")).toBeNull();
  });
});

describe("a project's KPI marker", () => {
  const september = "/?from=2026-09-01&to=2026-09-30";
  const leads = (conversions: number, kpi: ProjectFigures["kpi"] = { metric: "CONVERSIONS", target: "30.0000" }) =>
    ({ projectId: "p1", kpi, performance: { ...EMPTY_PERFORMANCE, conversions }, days: [] });

  const withFigures = (figures: unknown[]) => {
    const asked: string[] = [];
    server.use(
      mock.get("/api/clients", () => HttpResponse.json([aClient({ name: "Acme" })])),
      mock.get("/api/projects", () => HttpResponse.json([aProject({ id: "p1", name: "Летний запуск" })])),
      mock.get("/api/summary/projects", ({ request }) => {
        asked.push(new URL(request.url).search);
        return HttpResponse.json(figures);
      }),
    );
    return asked;
  };

  it.each([
    ["met", 30, "KPI: план выполнен"],
    ["somewhat behind", 27, "KPI: небольшое отставание"],
    ["at the lower edge of somewhat behind", 24, "KPI: небольшое отставание"],
    ["far behind", 23, "KPI: серьёзное отставание"],
  ])("names a KPI %s", async (_case, conversions, label) => {
    withFigures([leads(conversions)]);
    setup(september);

    expect(await screen.findByText(label)).toBeInTheDocument();
  });

  it("names a project without a KPI", async () => {
    withFigures([leads(30, null)]);
    setup(september);

    await screen.findByText("Летний запуск");
    expect(await screen.findByText("KPI: цель не задана или не измерена")).toBeInTheDocument();
  });

  it("follows a KPI set by hand", async () => {
    withFigures([{
      projectId: "p1",
      kpi: { metric: "MANUAL", name: "Продажи", value: "30.0000", target: "50.0000" },
      performance: EMPTY_PERFORMANCE,
      days: [],
    }]);
    setup(september);

    expect(await screen.findByText("KPI: серьёзное отставание")).toBeInTheDocument();
  });

  it("reads the figures of the selected period", async () => {
    const asked = withFigures([leads(30)]);
    setup(september);

    await screen.findByText("KPI: план выполнен");
    expect(asked).toContain("?from=2026-09-01&to=2026-09-30");
  });

  it("follows a KPI set on the project without a reload", async () => {
    let kpi: ProjectFigures["kpi"] = null;
    withFigures([]);
    server.use(
      mock.get("/api/summary/projects", () => HttpResponse.json([leads(30, kpi)])),
      mock.get("/api/projects/p1/kpi", () =>
        HttpResponse.json(kpi && { ...kpi, updatedAt: "2026-09-14T10:00:00.000Z" })),
      mock.put("/api/projects/p1/kpi", async ({ request }) => {
        const body = await request.json() as { metric: string; target: string };
        kpi = { metric: body.metric, target: Number(body.target).toFixed(4) };
        return HttpResponse.json({ ...kpi, updatedAt: "2026-09-14T11:00:00.000Z" });
      }),
    );
    renderWithProviders(
      <Routes>
        <Route path="*" element={(
          <>
            <ProjectList />
            <KpiTile
              scope={{ kind: "project", id: "p1" }}
              canEdit
              figures={{ ...EMPTY_PERFORMANCE, conversions: 30 }}
              range={{ from: "2026-09-01", to: "2026-09-30" }}
              currency="BYN"
            />
          </>
        )} />
      </Routes>,
      { route: september },
    );
    expect(await screen.findByText("KPI: цель не задана или не измерена")).toBeInTheDocument();

    await userEvent.click(await screen.findByRole("button", { name: "Задать цель" }));
    const dialog = await screen.findByRole("dialog", { name: "Цель KPI" });
    await userEvent.type(within(dialog).getByLabelText("Цель"), "30");
    await userEvent.click(within(dialog).getByRole("button", { name: "Сохранить" }));

    expect(await screen.findByText("KPI: план выполнен")).toBeInTheDocument();
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

  it("offers the create control and the edit action", async () => {
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
  });
});

describe("searching the project list", () => {
  const withProjects = () => server.use(
    mock.get("/api/clients", () => HttpResponse.json([
      aClient({ id: "1", name: "Acme" }),
      aClient({ id: "2", name: "Стоматология Улыбка" }),
    ])),
    mock.get("/api/projects", () => HttpResponse.json([
      aProject({ id: "summer", clientId: "1", name: "Летний запуск" }),
      aProject({ id: "autumn", clientId: "1", name: "Осенняя распродажа" }),
      aProject({ id: "implants", clientId: "2", name: "Имплантация" }),
    ])),
  );
  const searchField = () => screen.getByRole("searchbox", { name: "Поиск проектов" });

  it("offers a search field and no filter by the marker", async () => {
    withProjects();
    setup();
    await screen.findByText("Летний запуск");

    expect(searchField()).toBeInTheDocument();
    expect(screen.queryAllByRole("combobox")).toEqual([]);
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

describe("the narrowed project list", () => {
  const withProjects = () => server.use(
    mock.get("/api/clients", () => HttpResponse.json([aClient({ id: "1", name: "Acme" })])),
    mock.get("/api/projects", () => HttpResponse.json([
      aProject({ id: "summer", clientId: "1", name: "Летний запуск" }),
      aProject({ id: "autumn", clientId: "1", name: "Осенняя распродажа" }),
    ])),
  );
  const setupNarrowed = () => renderWithProviders(
    <Routes><Route path="*" element={<ProjectList collapsed />} /></Routes>,
    { route: "/" },
  );

  it("shows each project as its picture, named in a tooltip", async () => {
    const user = userEvent.setup();
    withProjects();
    setupNarrowed();

    const summer = await screen.findByRole("button", { name: "Летний запуск" });
    expect(screen.queryByText("Acme")).toBeNull();
    await user.hover(summer);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Летний запуск");
  });

  it("describes each picture with its project's KPI marker, keeping the project's name", async () => {
    withProjects();
    server.use(mock.get("/api/summary/projects", () => HttpResponse.json([{
      projectId: "summer",
      kpi: { metric: "MANUAL", name: "Продажи", value: "30.0000", target: "50.0000" },
      performance: EMPTY_PERFORMANCE,
      days: [],
    }])));
    setupNarrowed();

    const summer = await screen.findByRole("button", { name: "Летний запуск" });
    await waitFor(() => expect(summer).toHaveAccessibleDescription("KPI: серьёзное отставание"));
    expect(screen.getByRole("button", { name: "Осенняя распродажа" }))
      .toHaveAccessibleDescription("KPI: цель не задана или не измерена");
  });

  it("does not let a project be dragged", async () => {
    withProjects();
    setupNarrowed();

    await screen.findByRole("button", { name: "Летний запуск" });
    expect(screen.getByTestId("project-row-summer")).toHaveAttribute("data-draggable", "false");
  });

  it("searches from the magnifier", async () => {
    const user = userEvent.setup();
    withProjects();
    setupNarrowed();
    await screen.findByRole("button", { name: "Летний запуск" });
    expect(screen.queryByRole("searchbox")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Поиск проектов" }));
    await user.type(await screen.findByRole("searchbox", { name: "Поиск проектов" }), "осен");

    await waitFor(() => expect(screen.queryByRole("button", { name: "Летний запуск" })).toBeNull());
    expect(screen.getByRole("button", { name: "Осенняя распродажа" })).toBeInTheDocument();
  });
});

describe("editing a project from its context menu", () => {
  const withProject = () => server.use(
    mock.get("/api/clients", () => HttpResponse.json([aClient({ name: "Acme" })])),
    mock.get("/api/projects", () => HttpResponse.json([aProject({ name: "Летний запуск" })])),
  );

  it("opens the project form from Редактировать", async () => {
    const user = userEvent.setup();
    withProject();
    setup();

    fireEvent.contextMenu(await screen.findByText("Летний запуск"));
    await user.click(await screen.findByRole("menuitem", { name: "Редактировать" }));

    expect(await screen.findByLabelText("Название проекта")).toHaveValue("Летний запуск");
  });

  it("offers it from a picture of the narrowed list too", async () => {
    withProject();
    renderWithProviders(<Routes><Route path="*" element={<ProjectList collapsed />} /></Routes>, { route: "/" });

    fireEvent.contextMenu(await screen.findByRole("button", { name: "Летний запуск" }));

    expect(await screen.findByRole("menuitem", { name: "Редактировать" })).toBeInTheDocument();
  });

  it("is not offered to a member who may not update projects", async () => {
    withProject();
    server.use(mock.get("/api/auth/me", () => HttpResponse.json({
      user: { id: "u9", name: "Гость", email: "guest@acme.by", image: null },
      organization: { id: "org-1", name: "AdPulse", slug: "adpulse" },
      role: "GUEST",
      clientIds: [],
    })));
    setup();

    fireEvent.contextMenu(await screen.findByText("Летний запуск"));

    expect(await screen.findByRole("menuitem", { name: "Закрепить" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Редактировать" })).toBeNull();
  });
});

