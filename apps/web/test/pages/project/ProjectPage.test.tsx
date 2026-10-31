import { http as mock, HttpResponse } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import { aSession, aTask, renderWithProviders, server } from "@test/shared/index.js";
import { ProjectPage } from "@/pages/project/index.js";
import { useSourceMemory } from "@/entities/project/model/sourceMemory.js";
import { useColumnWidths } from "@/widgets/performance-table/columnWidths.js";

const performance = (spend: number, extra = {}) => ({
  spend, impressions: 100000, reach: 40000, clicks: 2000, conversions: 50, revenue: 4000,
  ctr: 2, cpc: 0.5, cpm: 10, cpa: 20, roas: 4, frequency: 2.5, ...extra,
});

const campaign = (id: string, name: string, channel: string, spend: number, sourceAccountId: string | null = null) => ({
  id, projectId: "p1", name, channel, status: "ACTIVE", objective: null,
  externalId: null, sourceAccountId, position: 0, performance: performance(spend), resultTypes: [],
});

function CampaignDestination() {
  const location = useLocation();
  return <><h2>Экран кампании</h2><output>{location.search}</output></>;
}

function App() {
  return (
    <Routes>
      <Route path="/projects/:projectId" element={<ProjectPage />} />
      <Route path="/projects/:projectId/campaigns/:campaignId" element={<CampaignDestination />} />
    </Routes>
  );
}

function api(options: { campaigns?: unknown[]; tasks?: unknown[]; summaryTiles?: string[] } = {}) {
  server.use(
    mock.get("/api/members", () => HttpResponse.json([])),
    mock.get("/api/tasks", () => HttpResponse.json(options.tasks ?? [])),
    mock.get("/api/projects", () => HttpResponse.json([{
      id: "p1", clientId: "cl1", name: "Клиника",
      budgetCurrency: "BYN",
      priority: "HIGH", image: null, avatarPath: null, position: 0, kpiTracked: true, createdAt: "", updatedAt: "",
    }])),
    mock.get("/api/clients", () => HttpResponse.json([{ id: "cl1", name: "Acme", orgId: "o1" }])),
    mock.get("/api/projects/:projectId/summary-tiles", () =>
      HttpResponse.json({ tiles: options.summaryTiles ?? ["CONVERSIONS"] })),
    mock.get("/api/projects/:projectId/summary", () => HttpResponse.json(performance(4200, { roas: 3 }))),
    mock.get("/api/projects/:projectId/campaigns", () => HttpResponse.json(options.campaigns ?? [
      campaign("c1", "Поиск / Москва", "YANDEX", 3000),
      campaign("c2", "Лента / Россия", "META", 1200),
    ])),
  );
}

const route = { route: "/projects/p1" };


const signedInAs = (role: string) => server.use(mock.get("/api/auth/me", () => HttpResponse.json({
  user: { id: "user-9", name: "Участник", email: "member@acme.com", image: null },
  organization: { id: "org-1", name: "AdPulse", slug: "adpulse" },
  role,
  clientIds: ["cl1"],
  modules: ["DASHBOARD", "PROJECTS", "CRM", "TASKS", "REPORTS"],
})));

const projectKpi = () => server.use(mock.get("/api/projects/p1/kpis", () =>
  HttpResponse.json([{ id: "k1", metric: "CONVERSIONS", target: "100.0000", enabled: true, updatedAt: "2026-09-14T10:00:00.000Z" }])));

const shownTiles = () => within(screen.getByRole("group", { name: "Показатели за период" }))
  .queryAllByTestId("summary-tile").map((tile) => tile.getAttribute("data-tile"));

describe("whether the project's KPIs are tracked", () => {
  const trackedProject = (kpiTracked: boolean) => ({
    id: "p1", clientId: "cl1", name: "Клиника", budgetCurrency: "BYN", image: null, avatarPath: null,
    position: 0, kpiTracked, createdAt: "", updatedAt: "",
  });

  it("is a switch in the header that a manager turns off and on", async () => {
    api();
    let tracked = true;
    const bodies: unknown[] = [];
    server.use(
      mock.get("/api/projects", () => HttpResponse.json([trackedProject(tracked)])),
      mock.patch("/api/projects/p1", async ({ request }) => {
        const body = await request.json() as { kpiTracked: boolean };
        bodies.push(body);
        tracked = body.kpiTracked;
        return HttpResponse.json(trackedProject(tracked));
      }),
    );
    signedInAs("MANAGER");
    renderWithProviders(<App />, route);

    const header = await screen.findByRole("banner");
    const toggle = await within(header).findByRole("switch", { name: "Отслеживать KPI" });
    expect(toggle).toBeChecked();
    expect(toggle).toBeEnabled();

    await userEvent.click(toggle);
    await waitFor(() => expect(within(header).getByRole("switch", { name: "Отслеживать KPI" })).not.toBeChecked());
    expect(bodies).toEqual([{ kpiTracked: false }]);

    await userEvent.click(within(header).getByRole("switch", { name: "Отслеживать KPI" }));
    await waitFor(() => expect(within(header).getByRole("switch", { name: "Отслеживать KPI" })).toBeChecked());
    expect(bodies).toEqual([{ kpiTracked: false }, { kpiTracked: true }]);
  });

  it("shows a reader its state without letting them change it", async () => {
    api();
    server.use(mock.get("/api/projects", () => HttpResponse.json([trackedProject(false)])));
    signedInAs("GUEST");
    renderWithProviders(<App />, route);

    const toggle = await within(await screen.findByRole("banner")).findByRole("switch", { name: "Отслеживать KPI" });
    expect(toggle).not.toBeChecked();
    expect(toggle).toBeDisabled();
  });

  it("says so when the change is refused", async () => {
    api();
    server.use(mock.patch("/api/projects/p1", () => HttpResponse.json({ error: { message: "no" } }, { status: 403 })));
    signedInAs("MANAGER");
    renderWithProviders(<App />, route);

    await userEvent.click(await within(await screen.findByRole("banner")).findByRole("switch", { name: "Отслеживать KPI" }));

    expect(await screen.findByText("Не удалось изменить отслеживание KPI")).toBeInTheDocument();
  });
});

describe("ProjectPage", () => {
  it("shows a client the project's tiles and KPI without letting them change either", async () => {
    api({ summaryTiles: ["CONVERSIONS", "KPI"] });
    signedInAs("CLIENT_ADMIN");
    projectKpi();
    renderWithProviders(<App />, route);

    const summary = await screen.findByRole("group", { name: "Показатели за период" });
    expect(await within(summary).findByText("KPI · Лиды")).toBeInTheDocument();
    expect(within(summary).queryByRole("button", { name: "Изменить цель" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Настроить показатели" })).not.toBeInTheDocument();
  });

  it("titles the integrations and the metrics for a member who manages integrations", async () => {
    api();
    renderWithProviders(<App />, route);

    expect(await screen.findByRole("heading", { name: "Интеграции", level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Метрики", level: 2 })).toBeInTheDocument();
  });

  it("titles only the metrics for a guest, who sees no integrations", async () => {
    api();
    signedInAs("GUEST");
    renderWithProviders(<App />, route);

    expect(await screen.findByRole("heading", { name: "Метрики", level: 2 })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Интеграции" })).not.toBeInTheDocument();
  });

  it("starts a project nobody has configured with no tile, only the placeholder", async () => {
    api({ summaryTiles: [] });
    renderWithProviders(<App />, route);

    expect(await screen.findByRole("button", { name: "Настроить показатели" })).toBeInTheDocument();
    expect(shownTiles()).toEqual([]);
  });

  it("shows a guest the tiles chosen for the project, with nothing to configure", async () => {
    api({ summaryTiles: ["SPEND", "CLICKS"] });
    signedInAs("GUEST");
    renderWithProviders(<App />, route);

    await waitFor(() => expect(shownTiles()).toEqual(["SPEND", "CLICKS"]));
    expect(screen.queryByRole("button", { name: "Настроить показатели" })).not.toBeInTheDocument();
  });

  it("offers the project's KPI in its summary and saves the choice to the project", async () => {
    api();
    projectKpi();
    let saved: unknown = null;
    server.use(mock.put("/api/projects/p1/summary-tiles", async ({ request }) => {
      const body = await request.json() as { tiles: string[] };
      saved = body;
      return HttpResponse.json(body);
    }));
    renderWithProviders(<App />, route);

    await userEvent.click(await screen.findByRole("button", { name: "Настроить показатели" }));
    const dialog = await screen.findByRole("dialog", { name: "Показатели за период" });
    await userEvent.click(within(dialog).getByRole("button", { name: "KPI" }));
    await userEvent.keyboard("{Escape}");

    const summary = screen.getByRole("group", { name: "Показатели за период" });
    expect(await within(summary).findByText("KPI · Лиды")).toBeInTheDocument();
    expect(within(summary).getByRole("button", { name: "Изменить цель" })).toBeInTheDocument();
    await waitFor(() => expect(saved).toEqual({ tiles: ["CONVERSIONS", "KPI"] }));
  });

  it("undoes a choice the server refuses and says it was not saved", async () => {
    api();
    server.use(mock.put("/api/projects/p1/summary-tiles", () =>
      HttpResponse.json({ error: { message: "Your role may not choose a project's summary" } }, { status: 403 })));
    renderWithProviders(<App />, route);

    await userEvent.click(await screen.findByRole("button", { name: "Настроить показатели" }));
    const dialog = await screen.findByRole("dialog", { name: "Показатели за период" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Клики" }));
    await userEvent.keyboard("{Escape}");

    expect(await screen.findByText("Не удалось сохранить показатели")).toBeInTheDocument();
    await waitFor(() => expect(shownTiles()).toEqual(["CONVERSIONS"]));
  });

  it("shows the project's figures for the period", async () => {
    api();
    renderWithProviders(<App />, route);

    const summary = await screen.findByRole("group", { name: "Показатели за период" });
    expect(await within(summary).findByText(/^CPL 20,00\sBr$/)).toBeInTheDocument();
    expect(screen.getByLabelText("От")).toBeInTheDocument();
    expect(screen.getByLabelText("До")).toBeInTheDocument();
  });

  it("lists the project's campaigns with their channel", async () => {
    api();
    renderWithProviders(<App />, route);

    const row = await screen.findByRole("row", { name: /Поиск \/ Москва/ });
    expect(within(row).getByText("Яндекс Директ · Активна")).toBeInTheDocument();
    expect(within(row).getByText("3 000 Br")).toBeInTheDocument();
  });

  it("offers no CRM stage columns in the campaign table", async () => {
    const user = userEvent.setup();
    api();
    renderWithProviders(<App />, route);

    await screen.findByRole("row", { name: /Поиск \/ Москва/ });
    await user.click(screen.getByRole("button", { name: "Отображаемые столбцы" }));
    expect(await screen.findByRole("menuitemcheckbox", { name: "Расход" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitemcheckbox", { name: /^CRM/ })).toBeNull();
  });

  it("totals the listed campaigns under them, deriving ratios from the sums", async () => {
    api();
    renderWithProviders(<App />, route);

    const footer = await screen.findByRole("row", { name: /Итого/ });
    expect(within(footer).getByText("4 200 Br")).toBeInTheDocument();
    expect(within(footer).getByText("1,90x")).toBeInTheDocument();
  });

  const messages = { ...campaign("c1", "Переписки", "META", 3000), resultTypes: ["MESSAGES"],
    performance: performance(3000, { resultTypes: [{ type: "MESSAGES", results: 120, spend: 3000 }] }) };
  const visits = { ...campaign("c2", "Профиль", "META", 1200), resultTypes: ["PROFILE_VISITS"],
    performance: performance(1200, { resultTypes: [{ type: "PROFILE_VISITS", results: 40, spend: 1200 }] }) };

  it("gives every result type of the project a results column, and no type or cost column", async () => {
    api({ campaigns: [messages, visits] });
    renderWithProviders(<App />, route);

    for (const name of ["Сообщения", "Переходы в профиль"]) {
      expect(await screen.findByRole("columnheader", { name: new RegExp(`^${name}`) })).toBeInTheDocument();
    }
    expect(screen.queryByRole("columnheader", { name: /Тип результата/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: /^Цена · / })).not.toBeInTheDocument();
    const row = await screen.findByRole("row", { name: /Переписки/ });
    expect(within(row).getByText("120")).toBeInTheDocument();
  });

  it("totals each result type in its column and the results as one number", async () => {
    api({ campaigns: [
      { ...messages, performance: { ...messages.performance, results: 120 } },
      { ...visits, performance: { ...visits.performance, results: 40 } },
    ] });
    renderWithProviders(<App />, route);

    const footer = await screen.findByRole("row", { name: /Итого/ });
    expect(within(footer).getByText("160")).toBeInTheDocument();
    expect(within(footer).getByText("120")).toBeInTheDocument();
    expect(within(footer).getByText("40")).toBeInTheDocument();
    expect(within(footer).queryByText(/Сообщения: /)).not.toBeInTheDocument();
  });

  it("gives a Google campaign a results column for each category of conversions its account has", async () => {
    const search = { ...campaign("c3", "Поиск", "GOOGLE", 400), resultTypes: ["LEADS", "CALLS", "CONTACTS"],
      performance: performance(400, { resultTypes: [
        { type: "CONTACTS", results: 6, spend: 400 },
        { type: "LEADS", results: 3.9966, spend: 400 },
        { type: "CALLS", results: 0, spend: 400 },
      ] }) };
    api({ campaigns: [search] });
    renderWithProviders(<App />, route);

    for (const name of [/^Результаты - Лиды/, /^Звонки/, /^Контакты/]) {
      expect(await screen.findByRole("columnheader", { name })).toBeInTheDocument();
    }
    expect(screen.queryByRole("columnheader", { name: /^Результаты - (Звонки|Контакты)/ })).not.toBeInTheDocument();
    const row = await screen.findByRole("row", { name: /Поиск/ });
    expect(within(row).getByText("6")).toBeInTheDocument();
    expect(within(row).getByText("4")).toBeInTheDocument();
  });

  it("offers no type columns for a project whose campaigns have no result type", async () => {
    api();
    renderWithProviders(<App />, route);

    await screen.findByRole("row", { name: /Итого/ });
    expect(screen.queryByRole("columnheader", { name: /^Результаты - / })).not.toBeInTheDocument();
  });

  it("opens a campaign when its row is chosen", async () => {
    const user = userEvent.setup();
    api();
    renderWithProviders(<App />, route);

    await user.click(await screen.findByRole("button", { name: /Поиск \/ Москва/ }));

    expect(await screen.findByRole("heading", { name: "Экран кампании" })).toBeInTheDocument();
  });

  it("keeps the selected range when a campaign is opened", async () => {
    const user = userEvent.setup();
    api();
    renderWithProviders(<App />, { route: "/projects/p1?from=2026-08-01&to=2026-08-09" });

    await user.click(await screen.findByRole("button", { name: /Поиск \/ Москва/ }));

    expect(await screen.findByText("?from=2026-08-01&to=2026-08-09")).toBeInTheDocument();
  });

  it("says so when the project has no campaigns yet", async () => {
    api({ campaigns: [] });
    renderWithProviders(<App />, route);

    expect(await screen.findByText("Кампаний пока нет")).toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "Только активные" })).toBeNull();
  });

  it("shows a placeholder instead of an empty table while campaigns load", async () => {
    let resolveCampaigns: ((response: Response) => void) | undefined;
    api();
    server.use(mock.get("/api/projects/:projectId/campaigns", () =>
      new Promise<Response>((resolve) => { resolveCampaigns = resolve; })));
    renderWithProviders(<App />, route);

    expect(await screen.findByRole("status", { name: "Загрузка кампаний" })).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText("Кампаний пока нет")).not.toBeInTheDocument();

    resolveCampaigns?.(HttpResponse.json([]));
    expect(await screen.findByText("Кампаний пока нет")).toBeInTheDocument();
  });

  it("shows the project under its client", async () => {
    api();
    renderWithProviders(<App />, route);

    expect(await screen.findByRole("heading", { name: "Клиника" })).toBeInTheDocument();
    expect(screen.getByText(/Acme/)).toBeInTheDocument();
  });

  it("carries no edit or delete control", async () => {
    api();
    renderWithProviders(<App />, route);
    await screen.findByRole("heading", { name: "Клиника" });

    expect(screen.queryByRole("button", { name: "Редактировать" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Удалить" })).not.toBeInTheDocument();
  });

  it("offers no activity history of its own", async () => {
    api();
    renderWithProviders(<App />, route);

    await screen.findByRole("heading", { name: "Метрики", level: 2 });
    expect(screen.queryByRole("button", { name: "История действий" })).not.toBeInTheDocument();
  });

  it("shows an error state with retry when the campaigns fail to load", async () => {
    api();
    server.use(mock.get("/api/projects/:projectId/campaigns", () =>
      new HttpResponse(null, { status: 500 })));
    renderWithProviders(<App />, route);

    expect(await screen.findByText("Что-то пошло не так")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Повторить" })).toBeInTheDocument();
  });

  it("says so when the project does not exist", async () => {
    api();
    renderWithProviders(<App />, { route: "/projects/missing" });

    expect(await screen.findByText("Проект не найден")).toBeInTheDocument();
  });
});

describe("the work in flight under a project", () => {
  const board = [
    aTask({ id: "t1", projectId: "p1", title: "Переписать объявления", column: "IN_PROGRESS" }),
    aTask({ id: "t2", projectId: "p1", title: "Собрать семантику", column: "IDEA" }),
    aTask({ id: "t3", projectId: "p1", title: "Проверить пиксель", column: "IN_REVIEW" }),
    aTask({ id: "t4", projectId: "p1", title: "Поправить оффер", column: "NEEDS_FIX" }),
    aTask({ id: "t5", projectId: "p1", title: "Старый отчёт", column: "DONE" }),
    aTask({ id: "t6", projectId: "p1", title: "Отложенное", column: "ARCHIVED" }),
  ];

  it("lists the tasks that are still in flight, below the campaigns", async () => {
    api({ tasks: board });
    renderWithProviders(<App />, route);

    for (const title of ["Переписать объявления", "Собрать семантику", "Проверить пиксель", "Поправить оффер"]) {
      expect(await screen.findByText(title)).toBeInTheDocument();
    }
  });

  it("leaves the tasks out for an organization without the task module", async () => {
    let asked = 0;
    api({ tasks: board });
    server.use(
      mock.get("/api/auth/me", () => HttpResponse.json(aSession({ modules: ["DASHBOARD", "PROJECTS"] }))),
      mock.get("/api/tasks", () => { asked += 1; return HttpResponse.json(board); }),
    );
    renderWithProviders(<App />, route);

    await screen.findByRole("heading", { name: "Метрики", level: 2 });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByText("Задачи в работе")).not.toBeInTheDocument();
    expect(screen.queryByText("Переписать объявления")).not.toBeInTheDocument();
    expect(asked).toBe(0);
  });

  it("leaves out what is done or archived", async () => {
    api({ tasks: board });
    renderWithProviders(<App />, route);

    await screen.findByText("Переписать объявления");
    expect(screen.queryByText("Старый отчёт")).not.toBeInTheDocument();
    expect(screen.queryByText("Отложенное")).not.toBeInTheDocument();
  });

  const asGuest = () => server.use(mock.get("/api/auth/me", () => HttpResponse.json({
    user: { id: "user-3", name: "Гость", email: "guest@acme.com", image: null },
    organization: { id: "org-1", name: "AdPulse", slug: "adpulse" },
    role: "GUEST",
    clientIds: ["cl1"],
    modules: ["DASHBOARD", "PROJECTS", "CRM", "TASKS", "REPORTS"],
  })));

  it("says so when nothing is in flight to a member who may not add a task", async () => {
    api({ tasks: [aTask({ id: "t5", projectId: "p1", title: "Старый отчёт", column: "DONE" })] });
    asGuest();
    renderWithProviders(<App />, route);

    expect(await screen.findByText("Нет задач в работе")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Новая задача" })).toBeNull();
  });

  it("offers only a new task in place of an empty list to a member who may add one", async () => {
    api({ tasks: [aTask({ id: "t5", projectId: "p1", title: "Старый отчёт", column: "DONE" })] });
    renderWithProviders(<App />, route);

    expect(await screen.findByRole("button", { name: "Новая задача" })).toBeInTheDocument();
    expect(screen.queryByText("Нет задач в работе")).toBeNull();
  });

  it("offers a new task after the tasks in flight", async () => {
    api({ tasks: board });
    renderWithProviders(<App />, route);

    await screen.findByText("Переписать объявления");
    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items).toHaveLength(5);
    expect(within(items[4]).getByRole("button", { name: "Новая задача" })).toBeInTheDocument();
  });

  const editableBoard = () => {
    let stored = [...board];
    server.use(
      mock.get("/api/tasks", () => HttpResponse.json(stored)),
      mock.patch("/api/tasks/:id", async ({ params, request }) => {
        const body = await request.json() as Record<string, unknown>;
        stored = stored.map((task) => task.id === params.id ? { ...task, title: String(body.title) } : task);
        return HttpResponse.json(stored.find((task) => task.id === params.id));
      }),
      mock.delete("/api/tasks/:id", ({ params }) => {
        stored = stored.filter((task) => task.id !== params.id);
        return new HttpResponse(null, { status: 204 });
      }),
    );
  };

  it("opens a task in its form, as the task module does, for a member who may change it", async () => {
    const user = userEvent.setup();
    api({ tasks: board });
    renderWithProviders(<App />, route);

    await user.click(await screen.findByRole("button", { name: /Переписать объявления/ }));

    const dialog = await screen.findByRole("dialog", { name: "Редактировать" });
    expect(within(dialog).getByLabelText("Название")).toHaveValue("Переписать объявления");
    expect(within(dialog).getByRole("button", { name: "Сохранить" })).toBeInTheDocument();
  });

  it("shows a change saved from the project in its list", async () => {
    const user = userEvent.setup();
    api();
    editableBoard();
    renderWithProviders(<App />, route);

    await user.click(await screen.findByRole("button", { name: /Переписать объявления/ }));
    const title = within(await screen.findByRole("dialog")).getByLabelText("Название");
    await user.clear(title);
    await user.type(title, "Переписать заголовки");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(await screen.findByRole("button", { name: /Переписать заголовки/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Переписать объявления/ })).toBeNull();
  });

  it("deletes a task from the project after confirmation", async () => {
    const user = userEvent.setup();
    api();
    editableBoard();
    renderWithProviders(<App />, route);

    await user.click(await screen.findByRole("button", { name: /Переписать объявления/ }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Удалить" }));
    await user.click(await screen.findByRole("button", { name: "Удалить задачу" }));

    await waitFor(() => expect(screen.queryByRole("button", { name: /Переписать объявления/ })).toBeNull());
    expect(screen.getByRole("button", { name: /Собрать семантику/ })).toBeInTheDocument();
  });

  it("opens a task read-only for a member who may not change it", async () => {
    const user = userEvent.setup();
    api({ tasks: board });
    asGuest();
    renderWithProviders(<App />, route);

    await user.click(await screen.findByRole("button", { name: /Переписать объявления/ }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Переписать объявления" }))
      .toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Сохранить" })).not.toBeInTheDocument();
  });

  const staff = [
    { id: "m-1", userId: "user-1", name: "Buyer", email: "buyer@acme.com", image: null, phone: null, telegram: null, role: "ADMIN", status: "ACTIVE", createdAt: "2026-09-01T00:00:00.000Z" },
    { id: "m-2", userId: "user-2", name: "Коллега", email: "colleague@acme.com", image: null, phone: null, telegram: null, role: "MANAGER", status: "ACTIVE", createdAt: "2026-09-01T00:00:00.000Z" },
  ];

  it("raises a task under the project for the member who raises it", async () => {
    const user = userEvent.setup();
    const stored: ReturnType<typeof aTask>[] = [];
    let body: Record<string, unknown> | null = null;
    api();
    server.use(
      mock.get("/api/members", () => HttpResponse.json(staff)),
      mock.get("/api/tasks", () => HttpResponse.json(stored)),
      mock.post("/api/tasks", async ({ request }) => {
        body = await request.json() as Record<string, unknown>;
        const task = aTask({ id: "t-new", projectId: "p1", title: String(body.title), column: "IDEA", participantIds: body.participantIds as string[] });
        stored.push(task);
        return HttpResponse.json(task, { status: 201 });
      }),
    );
    renderWithProviders(<App />, route);

    await user.click(await screen.findByRole("button", { name: "Новая задача" }));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(within(dialog).getByLabelText("Проект")).toHaveTextContent("Клиника"));
    expect(within(dialog).getByRole("button", { name: "Участники" })).toHaveTextContent("Buyer");
    await user.type(within(dialog).getByLabelText("Название"), "Обновить креативы");
    await user.click(within(dialog).getByRole("button", { name: "Создать задачу" }));

    expect(await screen.findByRole("button", { name: /Обновить креативы/ })).toBeInTheDocument();
    expect(body).toMatchObject({ title: "Обновить креативы", projectId: "p1", participantIds: ["m-1"] });
  });

  it("lets the task be given to a colleague before it is saved", async () => {
    const user = userEvent.setup();
    let body: Record<string, unknown> | null = null;
    api();
    server.use(
      mock.get("/api/members", () => HttpResponse.json(staff)),
      mock.post("/api/tasks", async ({ request }) => {
        body = await request.json() as Record<string, unknown>;
        return HttpResponse.json(aTask({ id: "t-new", projectId: "p1" }), { status: 201 });
      }),
    );
    renderWithProviders(<App />, route);

    await user.click(await screen.findByRole("button", { name: "Новая задача" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Название"), "Проверить пиксель");
    await user.click(within(dialog).getByRole("button", { name: "Участники" }));
    await user.click(await screen.findByRole("menuitemcheckbox", { name: "Коллега" }));
    await user.click(await screen.findByRole("menuitemcheckbox", { name: "Buyer" }));
    await user.keyboard("{Escape}");
    await user.click(within(dialog).getByRole("button", { name: "Создать задачу" }));

    await waitFor(() => expect(body).toMatchObject({ projectId: "p1", participantIds: ["m-2"] }));
  });

  it("offers a guest no new task beside the tasks in flight", async () => {
    api({ tasks: board });
    asGuest();
    renderWithProviders(<App />, route);

    await screen.findByText("Переписать объявления");
    expect(screen.queryByRole("button", { name: "Новая задача" })).toBeNull();
  });

  it("asks only for this project's tasks", async () => {
    const seen: URL[] = [];
    api();
    server.use(mock.get("/api/tasks", ({ request }) => {
      seen.push(new URL(request.url));
      return HttpResponse.json([]);
    }));
    renderWithProviders(<App />, route);

    await waitFor(() => expect(seen[0]?.searchParams.get("projectId")).toBe("p1"));
  });
});

describe("switching the campaigns by advertising account", () => {
  const twoAccounts = [
    campaign("c1", "Поиск / Москва", "META", 3000, "111"),
    campaign("c2", "Лента / Россия", "META", 1200, "222"),
  ];

  it("offers a tab per account and none combining them, starting on the first, with its own total", async () => {
    api({ campaigns: twoAccounts });
    renderWithProviders(<App />, route);

    const tabs = await screen.findByRole("radiogroup", { name: "Источник кампаний" });
    expect(within(tabs).getAllByRole("radio").map((tab) => tab.textContent)).toEqual(["Meta · 111", "Meta · 222"]);
    expect(within(tabs).getByRole("radio", { name: "Meta · 111" })).toBeChecked();
    expect(screen.getByText("Поиск / Москва")).toBeInTheDocument();
    expect(screen.queryByText("Лента / Россия")).toBeNull();
    expect(within(screen.getByRole("row", { name: /Итого/ })).getByText("3 000 Br")).toBeInTheDocument();
  });

  it("lists only the chosen account's campaigns, with their total", async () => {
    const user = userEvent.setup();
    api({ campaigns: twoAccounts });
    renderWithProviders(<App />, route);
    await screen.findByText("Поиск / Москва");

    await user.click(screen.getByRole("radio", { name: "Meta · 222" }));

    expect(screen.queryByText("Поиск / Москва")).toBeNull();
    expect(screen.getByText("Лента / Россия")).toBeInTheDocument();
    expect(within(screen.getByRole("row", { name: /Итого/ })).getByText("1 200 Br")).toBeInTheDocument();
  });

  it("remembers the chosen account when the member opens a campaign and comes back", async () => {
    const user = userEvent.setup();
    api({ campaigns: twoAccounts });
    const first = renderWithProviders(<App />, route);
    await screen.findByText("Поиск / Москва");
    await user.click(screen.getByRole("radio", { name: "Meta · 222" }));
    await user.click(screen.getByText("Лента / Россия"));
    expect(await screen.findByRole("heading", { name: "Экран кампании" })).toBeInTheDocument();
    first.unmount();

    renderWithProviders(<App />, route);

    expect(await screen.findByRole("radio", { name: "Meta · 222" })).toBeChecked();
    expect(screen.getByText("Лента / Россия")).toBeInTheDocument();
    expect(screen.queryByText("Поиск / Москва")).toBeNull();
  });

  it("starts on the first account when the remembered one is no longer there", async () => {
    useSourceMemory.setState({ sources: { p1: "META:999" } });
    api({ campaigns: twoAccounts });
    renderWithProviders(<App />, route);

    expect(await screen.findByRole("radio", { name: "Meta · 111" })).toBeChecked();
  });

  it("offers a tab for a second connection that has no campaigns yet", async () => {
    api({ campaigns: [campaign("c1", "Поиск / Москва", "META", 3000, "111")] });
    server.use(mock.get("/api/projects/:projectId/integrations", () => HttpResponse.json([
      { id: "i1", provider: "META", accountId: "111", currency: "BYN", timezone: "UTC", status: "SUCCESS", lastSuccessAt: null, lastError: null, nextDailyAt: "2026-09-09T06:00:00Z", leadsEnabled: true, leads: { status: "WAITING", lastSuccessAt: null, lastError: null } },
      { id: "i2", provider: "META", accountId: "333", currency: "BYN", timezone: "UTC", status: "QUEUED", lastSuccessAt: null, lastError: null, nextDailyAt: "2026-09-09T06:00:00Z", leadsEnabled: true, leads: { status: "WAITING", lastSuccessAt: null, lastError: null } },
    ])));
    renderWithProviders(<App />, route);

    expect(await screen.findByRole("radio", { name: "Meta · 333" })).toBeInTheDocument();
  });

  it("names each tab by its advertising system and keeps equal account numbers of two systems apart", async () => {
    const user = userEvent.setup();
    api({ campaigns: [
      campaign("c1", "Поиск / Москва", "META", 3000, "111"),
      campaign("c2", "Контекст", "GOOGLE", 1200, "111"),
    ] });
    renderWithProviders(<App />, route);

    const tabs = await screen.findByRole("radiogroup", { name: "Источник кампаний" });
    expect(within(tabs).getAllByRole("radio").map((tab) => tab.textContent)).toEqual(["Meta · 111", "Google Ads · 111"]);
    await user.click(screen.getByRole("radio", { name: "Google Ads · 111" }));
    expect(screen.getByText("Контекст")).toBeInTheDocument();
    expect(screen.queryByText("Поиск / Москва")).toBeNull();
  });

  it("shows the one account's tab and every campaign with the totals", async () => {
    api({ campaigns: [campaign("c1", "Поиск / Москва", "META", 3000, "111"), campaign("c2", "Лента / Россия", "META", 1200, "111")] });
    renderWithProviders(<App />, route);

    await screen.findByText("Лента / Россия");
    const tabs = screen.getByRole("radiogroup", { name: "Источник кампаний" });
    expect(within(tabs).getAllByRole("radio").map((tab) => tab.textContent)).toEqual(["Meta · 111"]);
    expect(screen.getByText("Поиск / Москва")).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /Итого/ })).toBeInTheDocument();
  });

  it("shows no tabs without any account", async () => {
    api();
    renderWithProviders(<App />, route);

    await screen.findByText("Лента / Россия");
    expect(screen.queryByRole("radiogroup", { name: "Источник кампаний" })).toBeNull();
  });

  const summary = () => screen.getByRole("group", { name: "Показатели за период" });
  const stamp = "2026-09-14T10:00:00.000Z";

  it("shows each account's own tiles, and the project's in a tab nobody configured", async () => {
    const user = userEvent.setup();
    api({ campaigns: twoAccounts });
    server.use(mock.get("/api/projects/:projectId/summary-tiles", () => HttpResponse.json({
      tiles: ["CONVERSIONS"],
      accounts: [{ account: { channel: "META", accountId: "222" }, tiles: ["CLICKS", "SPEND"] }],
    })));
    renderWithProviders(<App />, route);

    await waitFor(() => expect(shownTiles()).toEqual(["CONVERSIONS"]));
    await user.click(screen.getByRole("radio", { name: "Meta · 222" }));

    expect(shownTiles()).toEqual(["CLICKS", "SPEND"]);
  });

  it("saves a change made in a tab for that account alone", async () => {
    const user = userEvent.setup();
    api({ campaigns: twoAccounts });
    let saved: unknown = null;
    server.use(mock.put("/api/projects/p1/summary-tiles", async ({ request }) => {
      saved = await request.json();
      return HttpResponse.json({ tiles: ["CONVERSIONS"], accounts: [] });
    }));
    renderWithProviders(<App />, route);
    await screen.findByRole("radiogroup", { name: "Источник кампаний" });

    await user.click(screen.getByRole("radio", { name: "Meta · 222" }));
    await user.click(await screen.findByRole("button", { name: "Настроить показатели" }));
    await user.click(within(await screen.findByRole("dialog", { name: "Показатели за период" })).getByRole("button", { name: "Клики" }));
    await user.keyboard("{Escape}");

    await waitFor(() => expect(saved).toEqual({ tiles: ["CONVERSIONS", "CLICKS"], account: { channel: "META", accountId: "222" } }));
    expect(shownTiles()).toEqual(["CONVERSIONS", "CLICKS"]);
    await user.click(screen.getByRole("radio", { name: "Meta · 111" }));
    expect(shownTiles()).toEqual(["CONVERSIONS"]);
  });

  it("switches the one summary above to the chosen account's figures and KPIs, the tabs staying above the table", async () => {
    const user = userEvent.setup();
    api({ campaigns: twoAccounts, summaryTiles: ["SPEND", "KPI"] });
    server.use(mock.get("/api/projects/p1/kpis", () => HttpResponse.json([
      { id: "k1", metric: "CPA", target: "30.0000", enabled: true, account: { channel: "META", accountId: "111" }, updatedAt: stamp },
      { id: "k2", metric: "CPA", target: "24.0000", enabled: true, account: { channel: "META", accountId: "222" }, updatedAt: stamp },
    ])));
    renderWithProviders(<App />, route);

    const tabs = await screen.findByRole("radiogroup", { name: "Источник кампаний" });
    expect(screen.getAllByRole("group", { name: /^Показатели за период/ })).toHaveLength(1);
    expect(summary().compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await waitFor(() => expect(within(summary()).getByText("3 000 Br")).toBeInTheDocument());
    await waitFor(() =>
      expect(within(within(summary()).getByTestId("kpi-tile")).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50"));

    await user.click(screen.getByRole("radio", { name: "Meta · 222" }));

    expect(within(summary()).getByText("1 200 Br")).toBeInTheDocument();
    expect(within(within(summary()).getByTestId("kpi-tile")).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  });

  it("keeps the project's figures and every KPI in the summary of a project with one account", async () => {
    api({ campaigns: [campaign("c1", "Поиск / Москва", "META", 3000, "111")], summaryTiles: ["SPEND", "KPI"] });
    server.use(mock.get("/api/projects/p1/kpis", () => HttpResponse.json([
      { id: "k1", metric: "CPA", target: "30.0000", enabled: true, account: { channel: "META", accountId: "111" }, updatedAt: stamp },
      { id: "k2", metric: "CPA", target: "20.0000", enabled: true, account: null, updatedAt: stamp },
    ])));
    renderWithProviders(<App />, route);

    await screen.findByRole("radiogroup", { name: "Источник кампаний" });
    await waitFor(() => expect(within(summary()).getAllByTestId("kpi-tile")).toHaveLength(2));
    expect(within(summary()).getByText("4 200 Br")).toBeInTheDocument();
    expect(within(summary()).queryByText("Весь проект")).toBeNull();
  });

  it("offers a tab for an account that only a KPI names", async () => {
    api({ campaigns: [campaign("c1", "Поиск / Москва", "META", 3000, "111")] });
    server.use(mock.get("/api/projects/p1/kpis", () => HttpResponse.json([
      { id: "k1", metric: "SPEND", target: "1000.0000", enabled: true, account: { channel: "META", accountId: "555" }, updatedAt: "2026-09-14T10:00:00.000Z" },
    ])));
    renderWithProviders(<App />, route);

    const tabs = await screen.findByRole("radiogroup", { name: "Источник кампаний" });
    await waitFor(() =>
      expect(within(tabs).getAllByRole("radio").map((tab) => tab.textContent)).toEqual(["Meta · 111", "Meta · 555"]));
  });
});

describe("column layouts per advertising account", () => {
  const twoAccounts = [
    campaign("c1", "Поиск / Москва", "META", 3000, "111"),
    campaign("c2", "Лента / Россия", "META", 1200, "222"),
  ];
  const columnHeaders = () =>
    screen.getAllByRole("columnheader").map((header) => header.getAttribute("aria-label")).filter(Boolean);

  beforeEach(() => useColumnWidths.setState({
    nameWidths: {}, columnWidths: {}, columnOrder: {}, visibleColumns: {}, offeredColumns: {},
  }));

  it("keeps a column hidden on one account's tab only", async () => {
    const user = userEvent.setup();
    api({ campaigns: twoAccounts });
    renderWithProviders(<App />, route);
    await screen.findByRole("row", { name: /Поиск \/ Москва/ });
    expect(columnHeaders()).toContain("CPL");

    await user.click(screen.getByRole("button", { name: "Отображаемые столбцы" }));
    await user.click(await screen.findByRole("menuitemcheckbox", { name: "CPL" }));
    await user.keyboard("{Escape}");
    await waitFor(() => expect(columnHeaders()).not.toContain("CPL"));

    await user.click(screen.getByRole("radio", { name: "Meta · 222" }));
    await screen.findByRole("row", { name: /Лента \/ Россия/ });
    expect(columnHeaders()).toContain("CPL");

    await user.click(screen.getByRole("radio", { name: "Meta · 111" }));
    await screen.findByRole("row", { name: /Поиск \/ Москва/ });
    expect(columnHeaders()).not.toContain("CPL");
  });

  it("starts an account's layout from the one the table had before", async () => {
    useColumnWidths.setState({ visibleColumns: { campaigns: ["name", "spend", "clicks"] } });
    api({ campaigns: twoAccounts });
    renderWithProviders(<App />, route);

    await screen.findByRole("row", { name: /Поиск \/ Москва/ });
    await waitFor(() => expect(columnHeaders()).not.toContain("CPL"));
    expect(columnHeaders()).toEqual(expect.arrayContaining(["Расход", "Клики"]));
  });
});

describe("each campaign's indicator", () => {
  const toneOf = (name: string) =>
    screen.getByRole("row", { name: new RegExp(name) }).querySelector("[data-tone]")?.getAttribute("data-tone");

  it("follows the campaign's own KPI, and greys out what has none or is not running", async () => {
    const user = userEvent.setup();
    api({
      campaigns: [
        { ...campaign("c1", "Выполняет", "META", 1000), kpi: { metric: "CPA", target: "25.0000" } },
        { ...campaign("c2", "Отстаёт", "META", 1000), kpi: { metric: "CPA", target: "10.0000" } },
        campaign("c3", "По проекту", "META", 1000),
        { ...campaign("c4", "На паузе", "META", 1000), status: "PAUSED", kpi: { metric: "CPA", target: "25.0000" } },
      ],
    });
    server.use(mock.get("/api/projects/:projectId/kpis", () =>
      HttpResponse.json([{ id: "k1", metric: "CPA", target: "16.0000", enabled: true, updatedAt: "2026-09-01T00:00:00.000Z" }])));
    renderWithProviders(<App />, route);

    await screen.findByRole("row", { name: /Выполняет/ });
    await user.click(screen.getByRole("switch", { name: "Только активные" }));
    await waitFor(() => expect(toneOf("Выполняет")).toBe("profitable"));
    expect(toneOf("По проекту")).toBe("idle");
    expect(toneOf("Выполняет")).toBe("profitable");
    expect(toneOf("Отстаёт")).toBe("danger");
    expect(toneOf("На паузе")).toBe("idle");
  });
});

describe("the campaign KPI blocks above the table", () => {
  const withKpis = [
    { ...campaign("c1", "Выполняет", "META", 1000), kpi: { metric: "CPA", target: "25.0000" } },
    campaign("c2", "Без цели", "META", 1000),
    { ...campaign("c3", "Отстаёт", "META", 1000), kpi: { metric: "CPA", target: "10.0000" } },
    { ...campaign("c4", "На паузе", "META", 1000), status: "PAUSED", kpi: { metric: "CPA", target: "25.0000" } },
  ];
  const blocks = () => within(screen.getByRole("group", { name: "KPI кампаний" })).getAllByRole("button");
  const highlightedRows = () =>
    screen.getAllByRole("row").filter((row) => row.getAttribute("data-highlighted") === "true");

  it("shows one block per listed campaign holding a KPI, in the table's order, with its progress", async () => {
    api({ campaigns: withKpis });
    renderWithProviders(<App />, route);

    await screen.findByRole("group", { name: "KPI кампаний" });
    expect(blocks()).toHaveLength(2);
    expect(blocks()[0]).toHaveTextContent("Выполняет");
    expect(blocks()[0]).toHaveTextContent("CPL");
    expect(blocks()[0]).toHaveTextContent("125%");
    expect(blocks()[0]).toHaveAttribute("data-tone", "profitable");
    expect(blocks()[1]).toHaveTextContent("Отстаёт");
    expect(blocks()[1]).toHaveTextContent("50%");
    expect(blocks()[1]).toHaveAttribute("data-tone", "danger");
  });

  it("shows a paused campaign's block grey once paused campaigns are listed", async () => {
    const user = userEvent.setup();
    api({ campaigns: withKpis });
    renderWithProviders(<App />, route);
    await screen.findByRole("group", { name: "KPI кампаний" });

    await user.click(screen.getByRole("switch", { name: "Только активные" }));

    expect(blocks()).toHaveLength(3);
    expect(blocks()[2]).toHaveTextContent("На паузе");
    expect(blocks()[2]).toHaveAttribute("data-tone", "idle");
  });

  it("shows no blocks when no listed campaign holds a KPI", async () => {
    api();
    renderWithProviders(<App />, route);

    await screen.findByRole("row", { name: /Поиск \/ Москва/ });
    expect(screen.queryByRole("group", { name: "KPI кампаний" })).toBeNull();
  });

  it("highlights the campaign's row while its block is hovered or focused", async () => {
    const user = userEvent.setup();
    api({ campaigns: withKpis });
    renderWithProviders(<App />, route);
    await screen.findByRole("group", { name: "KPI кампаний" });

    await user.hover(blocks()[1]!);
    expect(highlightedRows()).toEqual([screen.getByRole("row", { name: /Отстаёт/ })]);

    await user.unhover(blocks()[1]!);
    expect(highlightedRows()).toEqual([]);

    blocks()[0]!.focus();
    await waitFor(() => expect(highlightedRows()).toEqual([screen.getByRole("row", { name: /Выполняет/ })]));
  });

  it("brings a highlighted row into a long table's window", async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 24 }, (_, index) => campaign(`c${index}`, `Кампания ${index + 1}`, "META", 100));
    many[23] = { ...many[23]!, kpi: { metric: "CPA", target: "25.0000" } } as (typeof many)[number];
    api({ campaigns: many });
    renderWithProviders(<App />, route);
    await screen.findByRole("group", { name: "KPI кампаний" });
    expect(screen.queryByRole("row", { name: /Кампания 24/ })).toBeNull();

    await user.hover(blocks()[0]!);

    expect(await screen.findByRole("row", { name: /Кампания 24/ })).toHaveAttribute("data-highlighted", "true");
  });

  it("opens the campaign with the period when its block is pressed", async () => {
    const user = userEvent.setup();
    api({ campaigns: withKpis });
    renderWithProviders(<App />, { route: "/projects/p1?from=2026-09-01&to=2026-09-30" });
    await screen.findByRole("group", { name: "KPI кампаний" });

    await user.click(blocks()[1]!);

    expect(await screen.findByRole("heading", { name: "Экран кампании" })).toBeInTheDocument();
    expect(screen.getByText("?from=2026-09-01&to=2026-09-30")).toBeInTheDocument();
  });
});

describe("showing only the running campaigns", () => {
  const mixed = [
    { ...campaign("c1", "Весна", "META", 100), status: "PAUSED" },
    campaign("c2", "Лето", "META", 200),
    { ...campaign("c3", "Осень", "META", 400), status: "ENDED" },
    { ...campaign("c4", "Зима", "META", 800), status: "LEARNING" },
    campaign("c5", "Оттепель", "META", 1600),
  ];
  const footer = () => screen.getByRole("row", { name: /Итого/ });
  const listedNames = () =>
    screen.getAllByText(/^(Весна|Лето|Осень|Зима|Оттепель)$/).map((name) => name.textContent);

  it("lists only the running campaigns in their order, with their total, whenever a project is opened", async () => {
    api({ campaigns: mixed });
    renderWithProviders(<App />, route);

    await screen.findByText("Лето");
    expect(screen.getByRole("switch", { name: "Только активные" })).toBeChecked();
    expect(listedNames()).toEqual(["Лето", "Зима", "Оттепель"]);
    expect(within(footer()).getByText("2 600 Br")).toBeInTheDocument();
    expect(within(footer()).getByText("4,62x")).toBeInTheDocument();
  });

  it("lists every campaign, running ones first, totalling them all once the switch is off", async () => {
    const user = userEvent.setup();
    api({ campaigns: mixed });
    renderWithProviders(<App />, route);
    await screen.findByText("Лето");

    await user.click(screen.getByRole("switch", { name: "Только активные" }));

    expect(listedNames()).toEqual(["Лето", "Зима", "Оттепель", "Весна", "Осень"]);
    expect(within(footer()).getByText("3 100 Br")).toBeInTheDocument();
    expect(within(footer()).getByText("6,45x")).toBeInTheDocument();
  });

  it("says so when nothing is running, and lists the rest once the switch is off", async () => {
    const user = userEvent.setup();
    api({ campaigns: [mixed[0], mixed[2]] });
    renderWithProviders(<App />, route);

    expect(await screen.findByText("Активных кампаний нет")).toBeInTheDocument();
    expect(screen.queryByText("Кампаний пока нет")).toBeNull();

    await user.click(screen.getByRole("switch", { name: "Только активные" }));

    expect(listedNames()).toEqual(["Весна", "Осень"]);
  });

  it("narrows the chosen account's campaigns", async () => {
    api({ campaigns: [
      { ...campaign("c1", "Весна", "META", 100, "111"), status: "PAUSED" },
      campaign("c2", "Лето", "META", 100, "111"),
      campaign("c3", "Зима", "META", 100, "222"),
    ] });
    renderWithProviders(<App />, route);

    await screen.findByText("Лето");
    expect(listedNames()).toEqual(["Лето"]);
  });

  it("is on again when another project is opened", async () => {
    const user = userEvent.setup();
    api({ campaigns: mixed });
    server.use(mock.get("/api/projects", () => HttpResponse.json(["p1", "p2"].map((id, position) => ({
      id, clientId: "cl1", name: id === "p1" ? "Клиника" : "Салон", budgetCurrency: "BYN",
      priority: "HIGH", image: null, avatarPath: null, position, createdAt: "", updatedAt: "",
    })))));
    renderWithProviders(<><App /><Link to="/projects/p2">Салон</Link></>, route);
    await screen.findByText("Лето");
    await user.click(screen.getByRole("switch", { name: "Только активные" }));
    expect(screen.getByRole("switch", { name: "Только активные" })).not.toBeChecked();

    await user.click(screen.getByRole("link", { name: "Салон" }));

    expect(await screen.findByRole("heading", { name: "Салон" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Только активные" })).toBeChecked();
    expect(listedNames()).toEqual(["Лето", "Зима", "Оттепель"]);
  });
});
