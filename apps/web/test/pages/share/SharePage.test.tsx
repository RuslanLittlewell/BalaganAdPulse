import { http as mock, HttpResponse } from "msw";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { clearTokens } from "@/shared/lib/index.js";
import { useSourceMemory } from "@/entities/project/model/sourceMemory.js";
import { aProject, server } from "@test/shared/index.js";
import { App } from "@/app/App.js";

const TOKEN = "Tk".repeat(21) + "x";
const BASE = `/api/shared/${TOKEN}`;

const SHARED_READS = [
  /^$/,
  /^\/projects\/p1\/(summary|campaigns|kpis|summary-tiles)$/,
  /^\/projects\/p1\/seo\/sites(\/[^/]+\/(traffic|search|top|vitals|audit|audit\/pages|audit\/pages\/[^/]+))?$/,
  /^\/crm\/boards\/[^/]+\/stage-counts$/,
  /^\/campaigns\/[^/]+(\/(kpi|daily|ad-sets))?$/,
  /^\/ad-sets\/[^/]+\/ads$/,
  /^\/ad-creatives\/[^/]+\/(file|poster)$/,
  /^\/ads\/[^/]+\/(preview|creatives)$/,
];

const performance = (spend: number) => ({
  spend, impressions: 100000, reach: 40000, clicks: 2000, conversions: 50, results: 0, revenue: 4000,
  ctr: 2, cpc: 1.5, cpm: 30, cpa: 60, costPerResult: null, roas: 1.3, frequency: 2.5,
});

const campaign = (id: string, name: string, account: string) => ({
  id, projectId: "p1", name, channel: "META", status: "ACTIVE", objective: null,
  externalId: null, sourceAccountId: account, position: 0, kpi: null, performance: performance(1000), resultTypes: [],
});

const site = {
  id: "s1", siteUrl: "sc-domain:site.ru", label: "site.ru", status: "SUCCESS", lastSuccessAt: "2026-11-07T06:00:00Z",
  lastError: null, checkStatus: "SUCCESS", lastCheckAt: "2026-11-05T06:00:00Z", checkError: null, analytics: null,
};

interface Served {
  modules?: string[];
  campaigns?: ReturnType<typeof campaign>[];
  sites?: (typeof site)[];
  opening?: () => Response;
}

let requested: { method: string; path: string }[] = [];

function serve(options: Served = {}) {
  const campaigns = options.campaigns ?? [campaign("c1", "Поиск / Москва", "act1")];
  server.use(
    mock.get(BASE, () => options.opening?.() ?? HttpResponse.json({
      project: aProject({ id: "p1", clientId: "cl1", name: "Клиника", budgetCurrency: "BYN" }),
      modules: options.modules ?? ["DASHBOARD", "PROJECTS", "CRM"],
    })),
    mock.get(`${BASE}/projects/p1/summary`, () => HttpResponse.json(performance(3000))),
    mock.get(`${BASE}/projects/p1/summary-tiles`, () => HttpResponse.json({ tiles: ["SPEND", "KPI"], accounts: [] })),
    mock.get(`${BASE}/projects/p1/kpis`, () => HttpResponse.json([
      { metric: "CONVERSIONS", target: "60.0000", enabled: true, account: null },
    ])),
    mock.get(`${BASE}/projects/p1/campaigns`, () => HttpResponse.json(campaigns)),
    mock.get(`${BASE}/projects/p1/seo/sites`, () => HttpResponse.json(options.sites ?? [])),
    mock.get(`${BASE}/projects/p1/seo/sites/s1/search`, () => HttpResponse.json({
      from: "2026-10-08", to: "2026-11-06", latestDay: null, days: [],
      totals: { clicks: 0, impressions: 0, ctr: 0, position: 0 }, previous: { clicks: 0, impressions: 0, ctr: 0, position: 0 },
    })),
    mock.get(`${BASE}/projects/p1/seo/sites/s1/top`, ({ request }) => HttpResponse.json({
      kind: new URL(request.url).searchParams.get("kind"), from: "2026-10-08", to: "2026-11-06", partial: false, totalClicks: 0, items: [],
    })),
    mock.get(`${BASE}/projects/p1/seo/sites/s1/vitals`, () => HttpResponse.json({ configured: false, readAt: null, devices: [] })),
    mock.get(`${BASE}/projects/p1/seo/sites/s1/traffic`, () => HttpResponse.json({ connected: false })),
    mock.get(`${BASE}/projects/p1/seo/sites/s1/audit`, () => HttpResponse.json({ status: "SUCCESS", lastCheckAt: null, checkError: null, result: null })),
    mock.get(`${BASE}/projects/p1/seo/sites/s1/audit/pages`, () => HttpResponse.json([])),
    mock.get(`${BASE}/crm/boards/p1/stage-counts`, () => HttpResponse.json({ campaigns: [], adSets: [], ads: [] })),
    mock.get(`${BASE}/campaigns/:campaignId`, ({ params }) =>
      HttpResponse.json(campaigns.find((entry) => entry.id === params.campaignId))),
    mock.get(`${BASE}/campaigns/:campaignId/kpi`, () => HttpResponse.json(null)),
    mock.get(`${BASE}/campaigns/:campaignId/daily`, () => HttpResponse.json([])),
    mock.get(`${BASE}/campaigns/:campaignId/ad-sets`, () => HttpResponse.json([])),
  );
}

function renderAppAt(path: string) {
  window.history.pushState({}, "", path);
  return render(<App />);
}

const outsideTheLink = () => requested.filter(({ method, path }) =>
  method !== "GET" || !path.startsWith(BASE) || !SHARED_READS.some((read) => read.test(path.slice(BASE.length))));

beforeEach(() => {
  clearTokens();
  useSourceMemory.setState({ sources: {} });
  requested = [];
  server.events.on("request:start", ({ request }) => {
    requested.push({ method: request.method, path: new URL(request.url).pathname });
  });
});

afterEach(() => {
  server.events.removeAllListeners();
});

describe("the page a share link opens", () => {
  it("shows the project's metrics to a visitor without an account, and nothing else", async () => {
    serve();
    renderAppAt(`/share/${TOKEN}`);

    expect(await screen.findByRole("heading", { name: "Клиника" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Метрики" })).toBeInTheDocument();
    expect(await screen.findByRole("row", { name: /Поиск \/ Москва/ })).toBeInTheDocument();
    expect(screen.getByText("KPI · Лиды")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Войти" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Задачи/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Задачи в работе")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Превью" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Выйти из превью" })).not.toBeInTheDocument();
    expect(outsideTheLink()).toEqual([]);
  });

  it("offers no control that changes the tiles or the KPIs", async () => {
    serve();
    renderAppAt(`/share/${TOKEN}`);

    expect(await screen.findByText("KPI · Лиды")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Настроить показатели" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Изменить цель|Задать цель/ })).not.toBeInTheDocument();
  });

  it("switches between the project's ad accounts", async () => {
    const user = userEvent.setup();
    serve({ campaigns: [campaign("c1", "Поиск / Москва", "act1"), campaign("c2", "Лента / Минск", "act2")] });
    renderAppAt(`/share/${TOKEN}`);

    const tabs = await screen.findByRole("radiogroup", { name: "Источник кампаний" });
    expect(await screen.findByRole("row", { name: /Поиск \/ Москва/ })).toBeInTheDocument();
    expect(screen.queryByRole("row", { name: /Лента \/ Минск/ })).not.toBeInTheDocument();

    await user.click(within(tabs).getByRole("radio", { name: "Meta · act2" }));

    expect(await screen.findByRole("row", { name: /Лента \/ Минск/ })).toBeInTheDocument();
    expect(screen.queryByRole("row", { name: /Поиск \/ Москва/ })).not.toBeInTheDocument();
  });

  it("names the single account in one tab, as preview does, and opens on its table", async () => {
    serve();
    renderAppAt(`/share/${TOKEN}`);

    const tabs = await screen.findByRole("radiogroup", { name: "Источник кампаний" });
    expect(within(tabs).getAllByRole("radio").map((tab) => tab.textContent)).toEqual(["Meta · act1"]);
    expect(await screen.findByRole("row", { name: /Поиск \/ Москва/ })).toBeInTheDocument();
  });

  it("offers the lead stage columns when the organization has CRM, and asks for no counts without it", async () => {
    const user = userEvent.setup();
    const stageColumns = async () => {
      await user.click(await screen.findByRole("button", { name: "Отображаемые столбцы" }));
      const offered = screen.queryAllByRole("menuitemcheckbox").map((item) => item.textContent);
      await user.keyboard("{Escape}");
      return offered;
    };
    serve();
    const first = renderAppAt(`/share/${TOKEN}`);
    expect(await screen.findByRole("row", { name: /Поиск \/ Москва/ })).toBeInTheDocument();
    expect(await stageColumns()).toContain("Квал. лид");
    await waitFor(() => expect(requested.some(({ path }) => path === `${BASE}/crm/boards/p1/stage-counts`)).toBe(true));
    first.unmount();

    requested = [];
    serve({ modules: ["DASHBOARD", "PROJECTS"] });
    renderAppAt(`/share/${TOKEN}`);
    expect(await screen.findByRole("row", { name: /Поиск \/ Москва/ })).toBeInTheDocument();
    expect(await stageColumns()).not.toContain("Квал. лид");
    expect(requested.some(({ path }) => path.includes("stage-counts"))).toBe(false);
  });

  it("shows a connected site's tab", async () => {
    const user = userEvent.setup();
    serve({ sites: [site] });
    renderAppAt(`/share/${TOKEN}`);

    await user.click(await screen.findByRole("radio", { name: "SEO · site.ru" }));

    expect(await screen.findByRole("radio", { name: "SEO · site.ru" })).toBeChecked();
    await waitFor(() => expect(requested.some(({ path }) => path === `${BASE}/projects/p1/seo/sites/s1/search`)).toBe(true));
    expect(outsideTheLink()).toEqual([]);
  });

  it("opens a campaign under the same link and comes back with the same period", async () => {
    const user = userEvent.setup();
    serve();
    renderAppAt(`/share/${TOKEN}?from=2026-10-01&to=2026-10-31`);

    await user.click(await screen.findByRole("button", { name: /Поиск \/ Москва/ }));

    expect(await screen.findByRole("heading", { name: "Поиск / Москва" })).toBeInTheDocument();
    expect(window.location.pathname).toBe(`/share/${TOKEN}/campaigns/c1`);
    expect(window.location.search).toBe("?from=2026-10-01&to=2026-10-31");

    await user.click(screen.getByRole("button", { name: "Назад к кампаниям" }));

    expect(await screen.findByRole("row", { name: /Поиск \/ Москва/ })).toBeInTheDocument();
    expect(window.location.pathname).toBe(`/share/${TOKEN}`);
    expect(window.location.search).toBe("?from=2026-10-01&to=2026-10-31");
    expect(outsideTheLink()).toEqual([]);
  });

  it("tells search engines to keep away", async () => {
    serve();
    renderAppAt(`/share/${TOKEN}`);

    expect(await screen.findByRole("heading", { name: "Клиника" })).toBeInTheDocument();
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe("noindex, nofollow");
  });
});

describe("a dead share link", () => {
  it("says the link is unavailable, with no figures and no login form", async () => {
    serve({ opening: () => HttpResponse.json({ error: { message: "Shared link not found" } }, { status: 404 }) });
    renderAppAt(`/share/${TOKEN}`);

    expect(await screen.findByRole("heading", { name: "Ссылка недоступна" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Метрики" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Войти" })).not.toBeInTheDocument();
    expect(outsideTheLink()).toEqual([]);
  });

  it("offers a retry when the link could not be checked", async () => {
    const user = userEvent.setup();
    let failing = true;
    serve({ opening: () => (failing
      ? HttpResponse.json({ error: { message: "Down" } }, { status: 503 })
      : HttpResponse.json({ project: aProject({ id: "p1", name: "Клиника" }), modules: ["DASHBOARD", "PROJECTS"] })) });
    renderAppAt(`/share/${TOKEN}`);

    const retry = await screen.findByRole("button", { name: "Повторить" });
    failing = false;
    await user.click(retry);

    expect(await screen.findByRole("heading", { name: "Клиника" })).toBeInTheDocument();
  });
});
