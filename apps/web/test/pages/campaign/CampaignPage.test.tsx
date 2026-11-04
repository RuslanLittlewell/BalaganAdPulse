import { http as mock, HttpResponse } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import { aSession, aTask, renderWithProviders, server } from "@test/shared/index.js";
import { CampaignPage } from "@/pages/campaign/index.js";

const performance = (spend: number, extra = {}) => ({
  spend, impressions: 100000, reach: 40000, clicks: 2000, conversions: 50, revenue: 4000,
  ctr: 2, cpc: 0.5, cpm: 10, cpa: 20, roas: 4, frequency: 2.5, ...extra,
});

const day = (date: string, spend: number) => ({
  date, spend, impressions: 0, reach: 0, clicks: 0, conversions: 0, revenue: 0,
});

function ProjectDestination() {
  const location = useLocation();
  return <><h1>Проект</h1><output>{location.search}</output></>;
}

function App() {
  return (
    <Routes>
      <Route path="/projects/:projectId/campaigns/:campaignId" element={<CampaignPage />} />
      <Route path="/projects/:projectId" element={<ProjectDestination />} />
    </Routes>
  );
}

function api(options: { adSets?: unknown[]; ads?: unknown[]; days?: unknown[]; summaryTiles?: string[] } = {}) {
  const creativeRequests: string[] = [];
  server.use(
    mock.get("/api/members", () => HttpResponse.json([])),
    mock.get("/api/projects", () => HttpResponse.json([{
      id: "p1", clientId: "cl1", name: "Клиника",
      budgetCurrency: "BYN", image: null, avatarPath: null, position: 0,
      createdAt: "", updatedAt: "",
    }])),
    mock.get("/api/campaigns/names", () => HttpResponse.json([])),
    mock.get("/api/projects/p1/summary-tiles", () =>
      HttpResponse.json({ tiles: options.summaryTiles ?? ["CONVERSIONS"] })),
    mock.get("/api/campaigns/:campaignId/daily", () =>
      HttpResponse.json(options.days ?? [day("2026-08-01", 400), day("2026-08-02", 900)])),
    mock.get("/api/campaigns/:campaignId/ad-sets", () => HttpResponse.json(options.adSets ?? [
      { id: "s1", campaignId: "c1", name: "Москва · 28–55", audience: "Гео Москва", resultType: "PROFILE_VISITS",
        status: "ACTIVE", externalId: null, position: 0, performance: performance(600) },
    ])),
    mock.get("/api/ad-sets/:adSetId/ads", () => HttpResponse.json(options.ads ?? [
      { id: "a1", adSetId: "s1", name: "Приём сегодня", format: "Текст", headline: null, resultType: "PROFILE_VISITS",
        status: "ACTIVE", externalId: null, position: 0, performance: performance(300) },
    ])),
    mock.get("/api/ads/:adId/creatives", ({ params }) => {
      creativeRequests.push(String(params.adId));
      return HttpResponse.json([{
        id: "cr1", position: 0, kind: "IMAGE", title: "Баннер", body: null,
        hasFile: true, hasPoster: false,
      }]);
    }),
    mock.get("/api/ad-creatives/:id/file", () =>
      HttpResponse.arrayBuffer(new Uint8Array([137, 80, 78, 71]).buffer as ArrayBuffer, {
        headers: { "content-type": "image/png" },
      })),
    mock.get("/api/campaigns/:campaignId", () => HttpResponse.json({
      id: "c1", projectId: "p1", name: "Поиск / Москва", channel: "YANDEX", status: "ACTIVE",
      objective: "Заявки", externalId: null, position: 0, performance: performance(1500),
      resultTypes: ["PROFILE_VISITS"],
    })),
  );
  return creativeRequests;
}

const route = { route: "/projects/p1/campaigns/c1" };

describe("CampaignPage", () => {
  it("names the campaign with its channel and status", async () => {
    api();
    renderWithProviders(<App />, route);

    expect(await screen.findByRole("heading", { name: "Поиск / Москва" })).toBeInTheDocument();
    expect(screen.getByText("Яндекс Директ · Активна · Заявки")).toBeInTheDocument();
    expect(screen.getByLabelText("От")).toBeInTheDocument();
    expect(screen.getByLabelText("До")).toBeInTheDocument();
  });

  it("gives the campaign's result type a results column, and no type or cost column", async () => {
    api({ adSets: [
      { id: "s1", campaignId: "c1", name: "Москва · 28–55", audience: null, resultType: "PROFILE_VISITS",
        status: "ACTIVE", externalId: null, position: 0,
        performance: { ...performance(600), resultTypes: [{ type: "PROFILE_VISITS", results: 30, spend: 600 }] } },
    ] });
    renderWithProviders(<App />, route);

    expect(await screen.findByRole("columnheader", { name: /^Переходы в профиль/ })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: /Тип результата/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: /^Цена · / })).not.toBeInTheDocument();
    const row = await screen.findByRole("row", { name: /Москва/ });
    expect(within(row).getByText("30")).toBeInTheDocument();
  });

  it("returns to the campaign list through the back arrow in the title", async () => {
    const user = userEvent.setup();
    api();
    renderWithProviders(<App />, route);

    await user.click(await screen.findByRole("button", { name: "Назад к кампаниям" }));
    expect(await screen.findByRole("heading", { name: "Проект" })).toBeInTheDocument();
  });

  it("keeps the selected range when returning to the project", async () => {
    const user = userEvent.setup();
    api();
    renderWithProviders(<App />, {
      route: "/projects/p1/campaigns/c1?from=2026-08-01&to=2026-08-09",
    });

    await user.click(await screen.findByRole("button", { name: "Назад к кампаниям" }));

    expect(await screen.findByText("?from=2026-08-01&to=2026-08-09")).toBeInTheDocument();
  });

  it("shows the campaign's figures for the period", async () => {
    api();
    renderWithProviders(<App />, route);

    const summary = await screen.findByRole("group", { name: "Показатели за период" });
    expect(await within(summary).findByText(/^CPL 20,00\sBr$/)).toBeInTheDocument();
  });

  it("shows the tiles chosen for its project and nothing to configure", async () => {
    api({ summaryTiles: ["CLICKS", "CONVERSIONS", "KPI"] });
    server.use(mock.get("/api/campaigns/:campaignId/kpi", () => HttpResponse.json(null)));
    renderWithProviders(<App />, route);

    const summary = await screen.findByRole("group", { name: "Показатели за период" });
    await waitFor(() => expect(within(summary).getAllByTestId("summary-tile").map((tile) => tile.getAttribute("data-tile")))
      .toEqual(["CLICKS", "CONVERSIONS", "KPI"]));
    expect(screen.queryByRole("button", { name: "Настроить показатели" })).not.toBeInTheDocument();
  });

  it("shows the campaign's own KPI against the campaign's figures, with a control to change it", async () => {
    api({ summaryTiles: ["KPI"] });
    let projectKpisAsked = false;
    server.use(
      mock.get("/api/projects/p1/kpis", () => {
        projectKpisAsked = true;
        return HttpResponse.json([]);
      }),
      mock.get("/api/campaigns/:campaignId/kpi", () =>
        HttpResponse.json({ metric: "CONVERSIONS", target: "60.0000", updatedAt: "2026-09-14T10:00:00.000Z" })),
    );
    renderWithProviders(<App />, { route: "/projects/p1/campaigns/c1?from=2026-09-01&to=2026-09-30" });

    const tile = await screen.findByTestId("kpi-tile");
    await waitFor(() => expect(tile).toHaveTextContent("KPI · Лиды"));
    expect(tile).toHaveTextContent("Цель 60 · 83%");
    expect(within(tile).getByRole("button", { name: "Изменить цель" })).toBeInTheDocument();
    expect(within(tile).queryByRole("img", { name: "Учитывается в результате проекта" })).not.toBeInTheDocument();
    expect(projectKpisAsked).toBe(false);
  });

  it("adds the campaign's KPI tile after the chosen tiles when the choice holds no KPI", async () => {
    api({ summaryTiles: ["CLICKS", "CONVERSIONS"] });
    server.use(mock.get("/api/campaigns/:campaignId/kpi", () => HttpResponse.json(null)));
    renderWithProviders(<App />, route);

    const summary = await screen.findByRole("group", { name: "Показатели за период" });
    await waitFor(() => expect(within(summary).getAllByTestId("summary-tile").map((tile) => tile.getAttribute("data-tile")))
      .toEqual(["CLICKS", "CONVERSIONS", "KPI"]));
    expect(await within(summary).findByRole("button", { name: "Задать цель" })).toBeInTheDocument();
  });

  describe("of a campaign imported from an account", () => {
    const fromAccount = () => server.use(
      mock.get("/api/campaigns/:campaignId/kpi", () => HttpResponse.json(null)),
      mock.get("/api/campaigns/:campaignId", () => HttpResponse.json({
        id: "c1", projectId: "p1", name: "Поиск / Москва", channel: "YANDEX", status: "ACTIVE",
        objective: "Заявки", externalId: null, sourceAccountId: "777", position: 0, performance: performance(1500),
        resultTypes: ["PROFILE_VISITS"],
      })),
    );
    const tilesShown = async () => {
      const summary = await screen.findByRole("group", { name: "Показатели за период" });
      return within(summary).getAllByTestId("summary-tile").map((tile) => tile.getAttribute("data-tile"));
    };

    it("shows the tiles chosen for its account", async () => {
      api({ summaryTiles: ["CONVERSIONS"] });
      fromAccount();
      server.use(mock.get("/api/projects/p1/summary-tiles", () => HttpResponse.json({
        tiles: ["CONVERSIONS"],
        accounts: [
          { account: { channel: "META", accountId: "777" }, tiles: ["SPEND"] },
          { account: { channel: "YANDEX", accountId: "777" }, tiles: ["CPC", "CLICKS"] },
        ],
      })));
      renderWithProviders(<App />, route);

      await waitFor(async () => expect(await tilesShown()).toEqual(["CPC", "CLICKS", "KPI"]));
    });

    it("shows the project's tiles when its account has none of its own", async () => {
      api({ summaryTiles: ["CONVERSIONS"] });
      fromAccount();
      server.use(mock.get("/api/projects/p1/summary-tiles", () => HttpResponse.json({
        tiles: ["CONVERSIONS"],
        accounts: [{ account: { channel: "META", accountId: "777" }, tiles: ["SPEND"] }],
      })));
      renderWithProviders(<App />, route);

      await waitFor(async () => expect(await tilesShown()).toEqual(["CONVERSIONS", "KPI"]));
    });
  });

  it("sets the campaign's KPI and fetches the campaign again for its colour", async () => {
    const user = userEvent.setup();
    api({ summaryTiles: ["KPI"] });
    let current: Record<string, string> | null = null;
    let campaignReads = 0;
    const saved: unknown[] = [];
    server.use(
      mock.get("/api/campaigns/:campaignId/kpi", () => HttpResponse.json(current)),
      mock.put("/api/campaigns/:campaignId/kpi", async ({ request }) => {
        const body = await request.json() as { metric: string; target: string };
        saved.push(body);
        current = { ...body, target: Number(body.target).toFixed(4), updatedAt: "2026-09-14T10:00:00.000Z" };
        return HttpResponse.json(current);
      }),
      mock.get("/api/campaigns/:campaignId", () => {
        campaignReads += 1;
        return HttpResponse.json({
          id: "c1", projectId: "p1", name: "Поиск / Москва", channel: "YANDEX", status: "ACTIVE",
          objective: null, externalId: null, position: 0, performance: performance(1500),
          resultTypes: ["MESSAGES"], kpi: current,
        });
      }),
    );
    renderWithProviders(<App />, route);

    await user.click(await screen.findByRole("button", { name: "Задать цель" }));
    const dialog = await screen.findByRole("dialog", { name: "Цель KPI" });
    await user.click(within(dialog).getByLabelText("Метрика"));
    await user.click(await screen.findByRole("option", { name: "Цена · Сообщения" }));
    await user.type(within(dialog).getByLabelText("Цель"), "20");
    const readsBefore = campaignReads;
    await user.click(within(dialog).getByRole("button", { name: "Сохранить" }));

    await waitFor(() => expect(saved).toEqual([{ metric: "COST_PER_RESULT", target: "20", resultType: "MESSAGES" }]));
    await waitFor(() => expect(campaignReads).toBeGreaterThan(readsBefore));
    expect(await screen.findByText("KPI · Цена · Сообщения")).toBeInTheDocument();
  });

  it("offers a guest no control to set the campaign's KPI", async () => {
    api({ summaryTiles: ["KPI"] });
    server.use(
      mock.get("/api/auth/me", () => HttpResponse.json(aSession({ role: "GUEST", clientIds: ["cl1"] }))),
      mock.get("/api/campaigns/:campaignId/kpi", () => HttpResponse.json(null)),
    );
    renderWithProviders(<App />, route);

    const tile = await screen.findByTestId("kpi-tile");
    await waitFor(() => expect(tile).toHaveTextContent("Цель не задана"));
    expect(within(tile).queryByRole("button")).not.toBeInTheDocument();
  });

  it("offers no control to change the campaign's KPI in preview", async () => {
    api({ summaryTiles: ["KPI"] });
    server.use(mock.get("/api/campaigns/:campaignId/kpi", () =>
      HttpResponse.json({ metric: "CONVERSIONS", target: "60.0000", updatedAt: "2026-09-14T10:00:00.000Z" })));
    renderWithProviders(<App />, { route: "/projects/p1/campaigns/c1?preview=1" });

    const tile = await screen.findByTestId("kpi-tile");
    await waitFor(() => expect(tile).toHaveTextContent("KPI · Лиды"));
    expect(within(tile).queryByRole("button")).not.toBeInTheDocument();
  });

  it("draws the measured days", async () => {
    api();
    renderWithProviders(<App />, route);

    expect(await screen.findByRole("img", { name: "Расход по дням" })).toBeInTheDocument();
  });

  it("says so when no day in the period was measured", async () => {
    api({ days: [] });
    renderWithProviders(<App />, route);

    expect(await screen.findByText("За период нет данных")).toBeInTheDocument();
  });

  it("lists the ad sets", async () => {
    api();
    renderWithProviders(<App />, route);

    const row = await screen.findByRole("row", { name: /Москва · 28–55/ });
    expect(within(row).getByText("600 Br")).toBeInTheDocument();
  });

  it("reveals the ads inside an ad set when it is expanded", async () => {
    const user = userEvent.setup();
    api();
    renderWithProviders(<App />, route);

    await user.click(await screen.findByRole("button", { name: /Москва · 28–55/ }));

    expect(await screen.findByText("Приём сегодня")).toBeInTheDocument();
  });

  it("opens the creative of an ad from its row", async () => {
    const user = userEvent.setup();
    const creativeRequests = api();
    renderWithProviders(<App />, route);

    await user.click(await screen.findByRole("button", { name: /Москва · 28–55/ }));
    expect(creativeRequests).toEqual([]);
    await user.click(await screen.findByRole("button", { name: /Приём сегодня/ }));

    const dialog = await screen.findByRole("dialog", { name: /Приём сегодня/ });
    expect(await within(dialog).findByAltText("Баннер")).toBeInTheDocument();
    expect(creativeRequests).toEqual(["a1"]);
  });

  it("says so when the campaign has no ad sets", async () => {
    api({ adSets: [] });
    renderWithProviders(<App />, route);

    expect(await screen.findByText("Групп объявлений пока нет")).toBeInTheDocument();
  });
});

describe("showing only the running ad sets and ads", () => {
  const adSet = (id: string, name: string, status: string) => ({
    id, campaignId: "c1", name, audience: null, resultType: "PROFILE_VISITS",
    status, externalId: null, position: 0, performance: performance(100),
  });
  const ad = (id: string, name: string, status: string) => ({
    id, adSetId: "s2", name, format: null, headline: null, resultType: "PROFILE_VISITS",
    status, externalId: null, position: 0, performance: performance(50),
  });
  const mixed = [
    adSet("s1", "Осень", "PAUSED"),
    adSet("s2", "Лето", "ACTIVE"),
    adSet("s3", "Зима", "ENDED"),
    adSet("s4", "Весна", "LEARNING"),
  ];
  const listedNames = () =>
    screen.getAllByText(/^(Осень|Лето|Зима|Весна|Свежий|Старый)$/).map((name) => name.textContent);

  it("lists only the running ad sets when a campaign is opened", async () => {
    api({ adSets: mixed });
    renderWithProviders(<App />, route);

    await screen.findByText("Лето");
    expect(screen.getByRole("switch", { name: "Только активные" })).toBeChecked();
    expect(listedNames()).toEqual(["Лето", "Весна"]);
  });

  it("lists everything, running ones first, once the switch is off", async () => {
    const user = userEvent.setup();
    api({ adSets: mixed });
    renderWithProviders(<App />, route);
    await screen.findByText("Лето");

    await user.click(screen.getByRole("switch", { name: "Только активные" }));

    expect(listedNames()).toEqual(["Лето", "Весна", "Осень", "Зима"]);
  });

  it("lists only the running ads of an expanded ad set until the switch is off", async () => {
    const user = userEvent.setup();
    api({ adSets: [adSet("s2", "Лето", "ACTIVE")], ads: [ad("a1", "Старый", "PAUSED"), ad("a2", "Свежий", "ACTIVE")] });
    renderWithProviders(<App />, route);

    await user.click(await screen.findByRole("button", { name: /Лето/ }));
    await screen.findByText("Свежий");
    expect(listedNames()).toEqual(["Лето", "Свежий"]);

    await user.click(screen.getByRole("switch", { name: "Только активные" }));
    expect(listedNames()).toEqual(["Лето", "Свежий", "Старый"]);
  });

  it("says no ad set is running rather than that there are none", async () => {
    api({ adSets: [adSet("s1", "Осень", "PAUSED")] });
    renderWithProviders(<App />, route);

    expect(await screen.findByText("Активных групп нет")).toBeInTheDocument();
    expect(screen.queryByText("Групп объявлений пока нет")).toBeNull();
  });

  it("is on again when another campaign is opened", async () => {
    const user = userEvent.setup();
    api({ adSets: mixed });
    renderWithProviders(<><App /><Link to="/projects/p1/campaigns/c2">Другая</Link></>, route);
    await screen.findByText("Лето");
    await user.click(screen.getByRole("switch", { name: "Только активные" }));
    expect(screen.getByRole("switch", { name: "Только активные" })).not.toBeChecked();

    await user.click(screen.getByRole("link", { name: "Другая" }));

    await waitFor(() => expect(screen.getByRole("switch", { name: "Только активные" })).toBeChecked());
    expect(listedNames()).toEqual(["Лето", "Весна"]);
  });

  it("offers no switch when the campaign has no ad sets", async () => {
    api({ adSets: [] });
    renderWithProviders(<App />, route);

    await screen.findByText("Групп объявлений пока нет");
    expect(screen.queryByRole("switch", { name: "Только активные" })).toBeNull();
  });
});

describe("CRM stage columns in the ad set table", () => {
  const STAGE_COLUMNS = ["Квал. лид", "Целевой лид", "КП"];

  const cell = (rowName: RegExp, column: string) => {
    const index = screen.getAllByRole("columnheader").findIndex((header) => header.textContent === column);
    expect(index).toBeGreaterThanOrEqual(0);
    return screen.getByRole("row", { name: rowName }).children[index];
  };

  it("shows each ad set's and ad's leads of the selected period by stage", async () => {
    const user = userEvent.setup();
    const requested: string[] = [];
    api();
    server.use(mock.get("/api/crm/boards/:board/stage-counts", ({ params, request }) => {
      requested.push(`${String(params.board)}${new URL(request.url).search}`);
      return HttpResponse.json({
        campaigns: [{ campaignId: "c1", NEW: 0, QUALIFIED: 0, TARGET: 1, PROPOSAL: 0 }],
        adSets: [{ adSetId: "s1", NEW: 0, QUALIFIED: 0, TARGET: 1, PROPOSAL: 0 }],
        ads: [{ adId: "a1", NEW: 0, QUALIFIED: 0, TARGET: 1, PROPOSAL: 0 }],
      });
    }));
    renderWithProviders(<App />, { route: "/projects/p1/campaigns/c1?from=2026-09-01&to=2026-09-30" });

    await screen.findByRole("row", { name: /Москва · 28–55/ });
    await user.click(screen.getByRole("button", { name: "Отображаемые столбцы" }));
    for (const column of STAGE_COLUMNS) {
      expect(await screen.findByRole("menuitemcheckbox", { name: column })).toHaveAttribute("aria-checked", "false");
    }
    expect(screen.queryByRole("menuitemcheckbox", { name: "Лид (Новый)" })).toBeNull();
    await user.click(screen.getByRole("menuitemcheckbox", { name: "Целевой лид" }));
    await user.keyboard("{Escape}");

    await waitFor(() => expect(cell(/Москва · 28–55/, "Целевой лид")).toHaveTextContent("1"));
    await user.click(screen.getByRole("button", { name: /Москва · 28–55/ }));
    await screen.findByRole("row", { name: /Приём сегодня/ });
    expect(cell(/Приём сегодня/, "Целевой лид")).toHaveTextContent("1");
    expect(requested).toContain("p1?from=2026-09-01&to=2026-09-30");
  });

  it("offers no stage column, and asks for no counts, without the CRM module", async () => {
    const user = userEvent.setup();
    let asked = 0;
    api();
    server.use(
      mock.get("/api/auth/me", () => HttpResponse.json(aSession({ modules: ["DASHBOARD", "PROJECTS", "TASKS"] }))),
      mock.get("/api/crm/boards/:board/stage-counts", () => {
        asked += 1;
        return HttpResponse.json({ campaigns: [], adSets: [], ads: [] });
      }),
    );
    renderWithProviders(<App />, route);

    await screen.findByRole("row", { name: /Москва · 28–55/ });
    await user.click(screen.getByRole("button", { name: "Отображаемые столбцы" }));
    expect(await screen.findByRole("menuitemcheckbox", { name: "Расход" })).toBeInTheDocument();
    for (const column of STAGE_COLUMNS) {
      expect(screen.queryByRole("menuitemcheckbox", { name: column })).not.toBeInTheDocument();
    }
    expect(asked).toBe(0);
  });
});
