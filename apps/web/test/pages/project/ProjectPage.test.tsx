import { http as mock, HttpResponse } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import { aTask, renderWithProviders, server } from "@test/shared/index.js";
import { ProjectPage } from "@/pages/project/index.js";

const performance = (spend: number, extra = {}) => ({
  spend, impressions: 100000, reach: 40000, clicks: 2000, conversions: 50, revenue: 4000,
  ctr: 2, cpc: 0.5, cpm: 10, cpa: 20, roas: 4, frequency: 2.5, ...extra,
});

const campaign = (id: string, name: string, channel: string, spend: number, sourceAccountId: string | null = null) => ({
  id, projectId: "p1", name, channel, status: "ACTIVE", objective: null,
  externalId: null, sourceAccountId, position: 0, performance: performance(spend),
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

function api(options: { campaigns?: unknown[]; tasks?: unknown[] } = {}) {
  server.use(
    mock.get("/api/members", () => HttpResponse.json([])),
    mock.get("/api/tasks", () => HttpResponse.json(options.tasks ?? [])),
    mock.get("/api/projects", () => HttpResponse.json([{
      id: "p1", clientId: "cl1", name: "Клиника",
      budgetCurrency: "BYN",
      priority: "HIGH", image: null, avatarPath: null, position: 0, createdAt: "", updatedAt: "",
    }])),
    mock.get("/api/clients", () => HttpResponse.json([{ id: "cl1", name: "Acme", orgId: "o1" }])),
    mock.get("/api/projects/:projectId/summary", () => HttpResponse.json(performance(4200, { roas: 3 }))),
    mock.get("/api/projects/:projectId/campaigns", () => HttpResponse.json(options.campaigns ?? [
      campaign("c1", "Поиск / Москва", "YANDEX", 3000),
      campaign("c2", "Лента / Россия", "META", 1200),
    ])),
  );
}

const route = { route: "/projects/p1" };

describe("ProjectPage", () => {
  it("shows a client the project's KPI without letting them change it", async () => {
    api();
    server.use(
      mock.get("/api/auth/me", () => HttpResponse.json({
        user: { id: "user-9", name: "Клиент", email: "client@acme.com", image: null },
        organization: { id: "org-1", name: "AdPulse", slug: "adpulse" },
        role: "CLIENT_ADMIN",
        clientIds: ["cl1"],
      })),
      mock.get("/api/projects/p1/kpi", () => HttpResponse.json({ metric: "CONVERSIONS", target: "100.0000", updatedAt: "2026-09-14T10:00:00.000Z" })),
    );
    renderWithProviders(<App />, route);

    await userEvent.click(await screen.findByRole("button", { name: "Настроить показатели" }));
    const dialog = await screen.findByRole("dialog", { name: "Показатели за период" });
    await userEvent.click(within(dialog).getByRole("button", { name: "KPI" }));
    await userEvent.keyboard("{Escape}");

    const summary = screen.getByRole("group", { name: "Показатели за период" });
    expect(await within(summary).findByText("KPI · Лиды")).toBeInTheDocument();
    expect(within(summary).queryByRole("button", { name: "Изменить цель" })).not.toBeInTheDocument();
  });

  it("offers the project's KPI in its summary", async () => {
    api();
    server.use(mock.get("/api/projects/p1/kpi", () => HttpResponse.json({ metric: "CONVERSIONS", target: "100.0000", updatedAt: "2026-09-14T10:00:00.000Z" })));
    renderWithProviders(<App />, route);

    await userEvent.click(await screen.findByRole("button", { name: "Настроить показатели" }));
    const dialog = await screen.findByRole("dialog", { name: "Показатели за период" });
    await userEvent.click(within(dialog).getByRole("button", { name: "KPI" }));
    await userEvent.keyboard("{Escape}");

    const summary = screen.getByRole("group", { name: "Показатели за период" });
    expect(await within(summary).findByText("KPI · Лиды")).toBeInTheDocument();
    expect(within(summary).getByRole("button", { name: "Изменить цель" })).toBeInTheDocument();
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

  it("opens project-scoped activity from the header", async () => {
    const user = userEvent.setup();
    let projectFilter: string | null = null;
    api();
    server.use(mock.get("/api/audit", ({ request }) => {
      projectFilter = new URL(request.url).searchParams.get("projectId");
      return HttpResponse.json({ items: [], nextCursor: null });
    }));
    renderWithProviders(<App />, route);

    await user.click(await screen.findByRole("button", { name: "История действий" }));

    expect(await screen.findByRole("dialog", { name: "История действий" })).toBeInTheDocument();
    await waitFor(() => expect(projectFilter).toBe("p1"));
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

  it("leaves out what is done or archived", async () => {
    api({ tasks: board });
    renderWithProviders(<App />, route);

    await screen.findByText("Переписать объявления");
    expect(screen.queryByText("Старый отчёт")).not.toBeInTheDocument();
    expect(screen.queryByText("Отложенное")).not.toBeInTheDocument();
  });

  it("says so when nothing is in flight", async () => {
    api({ tasks: [aTask({ id: "t5", projectId: "p1", title: "Старый отчёт", column: "DONE" })] });
    renderWithProviders(<App />, route);

    expect(await screen.findByText("Нет задач в работе")).toBeInTheDocument();
  });

  it("opens a task read-only when its row is chosen", async () => {
    const user = userEvent.setup();
    api({ tasks: board });
    renderWithProviders(<App />, route);

    await user.click(await screen.findByRole("button", { name: /Переписать объявления/ }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Переписать объявления" }))
      .toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Сохранить" })).not.toBeInTheDocument();
  });

  it("asks only for this project's tasks", async () => {
    const seen: URL[] = [];
    api();
    server.use(mock.get("/api/tasks", ({ request }) => {
      seen.push(new URL(request.url));
      return HttpResponse.json([]);
    }));
    renderWithProviders(<App />, route);

    await screen.findByText("Нет задач в работе");
    expect(seen[0].searchParams.get("projectId")).toBe("p1");
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
});

describe("each campaign's indicator", () => {
  const toneOf = (name: string) =>
    screen.getByRole("row", { name: new RegExp(name) }).querySelector("[data-tone]")?.getAttribute("data-tone");

  it("follows the campaign's KPI, the project's in its absence, and greys out what is not running", async () => {
    const user = userEvent.setup();
    api({
      campaigns: [
        { ...campaign("c1", "Выполняет", "META", 1000), kpi: { metric: "CPA", target: "25.0000" } },
        { ...campaign("c2", "Отстаёт", "META", 1000), kpi: { metric: "CPA", target: "10.0000" } },
        campaign("c3", "По проекту", "META", 1000),
        { ...campaign("c4", "На паузе", "META", 1000), status: "PAUSED", kpi: { metric: "CPA", target: "25.0000" } },
      ],
    });
    server.use(mock.get("/api/projects/:projectId/kpi", () =>
      HttpResponse.json({ metric: "CPA", target: "18.0000", updatedAt: "2026-09-01T00:00:00.000Z" })));
    renderWithProviders(<App />, route);

    await screen.findByText("Выполняет");
    await user.click(screen.getByRole("switch", { name: "Только активные" }));
    await waitFor(() => expect(toneOf("По проекту")).toBe("stable"));
    expect(toneOf("Выполняет")).toBe("profitable");
    expect(toneOf("Отстаёт")).toBe("danger");
    expect(toneOf("На паузе")).toBe("idle");
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
