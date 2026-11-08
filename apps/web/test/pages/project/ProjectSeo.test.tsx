import { http as mock, HttpResponse } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders, server } from "@test/shared/index.js";
import { ProjectPage } from "@/pages/project/index.js";
import { useSourceMemory } from "@/entities/project/model/sourceMemory.js";

const performance = (spend: number) => ({
  spend, impressions: 100000, reach: 40000, clicks: 2000, conversions: 50, revenue: 4000,
  ctr: 2, cpc: 0.5, cpm: 10, cpa: 20, roas: 4, frequency: 2.5,
});
const site = {
  id: "s1", siteUrl: "sc-domain:site.ru", label: "site.ru", status: "SUCCESS", lastSuccessAt: "2026-11-07T06:00:00Z",
  lastError: null, checkStatus: "SUCCESS", lastCheckAt: "2026-11-05T06:00:00Z", checkError: null, analytics: null,
};
const totals = (clicks: number, impressions: number, position: number) => ({ clicks, impressions, ctr: clicks / impressions, position });
const seo = "/api/projects/p1/seo/sites/s1";

function App() {
  return <Routes><Route path="/projects/:projectId" element={<ProjectPage />} /></Routes>;
}

const signedInAs = (role: string) => server.use(mock.get("/api/auth/me", () => HttpResponse.json({
  user: { id: "user-9", name: "Участник", email: "member@acme.com", image: null },
  organization: { id: "org-1", name: "AdPulse", slug: "adpulse" },
  role,
  status: "ACTIVE",
  modules: [],
})));

const desktopLab = { score: 45, rating: "POOR", lcpMs: 4100, cls: 0.2, tbtMs: 600, fcpMs: 2000, speedIndexMs: 5000 };

function api(options: { sites?: unknown[]; checkStatus?: string; labs?: Record<string, typeof desktopLab>; traffic?: unknown } = {}) {
  const labs = options.labs ?? { DESKTOP: desktopLab };
  server.use(
    mock.get("/api/members", () => HttpResponse.json([])),
    mock.get("/api/tasks", () => HttpResponse.json([])),
    mock.get("/api/projects", () => HttpResponse.json([{
      id: "p1", clientId: "cl1", name: "Клиника", budgetCurrency: "BYN",
      priority: "HIGH", image: null, avatarPath: null, position: 0, kpiTracked: true, createdAt: "", updatedAt: "",
    }])),
    mock.get("/api/clients", () => HttpResponse.json([{ id: "cl1", name: "Acme", orgId: "o1" }])),
    mock.get("/api/projects/:projectId/summary", () => HttpResponse.json(performance(4200))),
    mock.get("/api/projects/:projectId/campaigns", () => HttpResponse.json([{
      id: "c1", projectId: "p1", name: "Лента / Россия", channel: "META", status: "ACTIVE", objective: null,
      externalId: null, sourceAccountId: "111", position: 0, performance: performance(1200), resultTypes: [],
    }])),
    mock.get("/api/projects/p1/seo/sites", () => HttpResponse.json(options.sites ?? [site])),
    mock.get(`${seo}/search`, () => HttpResponse.json({
      from: "2026-10-08", to: "2026-11-06", latestDay: "2026-11-04",
      totals: totals(500, 20000, 9.1),
      previous: totals(400, 16000, 12.4),
      days: [
        { date: "2026-11-03", ...totals(200, 9000, 9.5) },
        { date: "2026-11-04", ...totals(300, 11000, 8.8) },
      ],
    })),
    mock.get(`${seo}/top`, ({ request }) => {
      const kind = new URL(request.url).searchParams.get("kind");
      const limit = Number(new URL(request.url).searchParams.get("limit"));
      const items = Array.from({ length: Math.min(limit, 12) }, (_, index) => ({
        key: kind === "query" ? `запрос ${index + 1}` : `https://site.ru/page-${index + 1}`,
        clicks: 50 - index, impressions: 1000, ctr: 0.05, position: 3, share: 0.1,
      }));
      return HttpResponse.json({ kind, from: "2026-10-08", to: "2026-11-06", partial: false, totalClicks: 500, items });
    }),
    mock.get(`${seo}/vitals`, () => HttpResponse.json({
      configured: true,
      readAt: "2026-11-07T06:00:00Z",
      devices: (["PHONE", "DESKTOP"] as const).map((device) => {
        const lab = labs[device];
        return {
          device, periodEnd: null, passes: null, metrics: [],
          lab: lab ? { device, measuredAt: "2026-11-05T06:00:00Z", ...lab } : null,
        };
      }),
    })),
    mock.get(`${seo}/traffic`, () => HttpResponse.json(options.traffic ?? { connected: false })),
    mock.get(`${seo}/audit`, () => HttpResponse.json({
      status: options.checkStatus ?? "SUCCESS", lastCheckAt: "2026-11-05T06:00:00Z", checkError: null,
      result: {
        finishedAt: "2026-11-05T06:00:00Z", checked: 4, notChecked: 0, pagesWithErrors: 1, pagesWithWarnings: 3,
        kinds: [
          { kind: "HTTP_ERROR", severity: "ERROR", pages: 1 },
          { kind: "DESCRIPTION_MISSING", severity: "WARNING", pages: 3 },
        ],
      },
    })),
    mock.get(`${seo}/audit/pages`, ({ request }) => {
      const kind = new URL(request.url).searchParams.get("kind");
      const pages = [
        { id: "pg1", url: "https://site.ru/page-1", status: 200, outcome: "FETCHED", problems: [{ kind: "DESCRIPTION_MISSING", severity: "WARNING" }] },
        { id: "pg2", url: "https://site.ru/gone", status: 404, outcome: "FETCHED", problems: [{ kind: "HTTP_ERROR", severity: "ERROR" }] },
      ];
      return HttpResponse.json(kind ? pages.filter((page) => page.problems.some((problem) => problem.kind === kind)) : pages);
    }),
    mock.get(`${seo}/audit/pages/pg1`, () => HttpResponse.json({
      id: "pg1", url: "https://site.ru/page-1", status: 200, outcome: "FETCHED",
      problems: [{ kind: "DESCRIPTION_MISSING", severity: "WARNING" }],
      finalUrl: "https://site.ru/page-1", contentType: "text/html", responseMs: 120, inSitemap: true, hasImpressions: true,
      facts: {
        lang: "ru", title: "Окна на заказ", description: null, keywords: "окна", robots: [], canonical: null, h1: ["Окна"],
        openGraph: { "og:title": "Окна" },
        jsonLd: [
          { source: '{"@type":"Organization","name":"Окна"}', types: ["Organization"], error: null },
          { source: '{"@type":"BreadcrumbList"}', types: ["BreadcrumbList"], error: null },
        ],
      },
      search: { clicks: 50, impressions: 1000, position: 3 },
    })),
  );
}

const route = { route: "/projects/p1?from=2026-10-08&to=2026-11-06" };

beforeEach(() => {
  useSourceMemory.setState({ sources: {} });
});

const openSeo = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole("radio", { name: "SEO · site.ru" }));
};

describe("a connected site on the project page", () => {
  it("gets its own tab after the advertising accounts", async () => {
    api();
    renderWithProviders(<App />, route);

    const tabs = await screen.findByRole("radiogroup", { name: "Источник кампаний" });
    await waitFor(() => expect(within(tabs).getAllByRole("radio").map((tab) => tab.textContent)).toEqual(["Meta · 111", "SEO · site.ru"]));
    expect(within(tabs).getByRole("radio", { name: "Meta · 111" })).toBeChecked();
    expect(screen.getByText("Лента / Россия")).toBeInTheDocument();
  });

  it("shows the site's search tiles and SEO view in place of the campaigns, and keeps the tab on return", async () => {
    const user = userEvent.setup();
    api();
    const first = renderWithProviders(<App />, route);

    await openSeo(user);

    const tiles = await screen.findByRole("list", { name: "SEO" });
    expect(within(tiles).getByText("Клики")).toBeInTheDocument();
    expect(within(tiles).getByText("Средняя позиция")).toBeInTheDocument();
    expect(screen.queryByText("Лента / Россия")).toBeNull();
    expect(screen.getByRole("region", { name: "Проверка страниц" })).toBeInTheDocument();
    first.unmount();

    renderWithProviders(<App />, route);
    expect(await screen.findByRole("radio", { name: "SEO · site.ru" })).toBeChecked();
  });

  it("counts a better position as an improvement", async () => {
    const user = userEvent.setup();
    api();
    renderWithProviders(<App />, route);
    await openSeo(user);

    const tiles = await screen.findByRole("list", { name: "SEO" });
    const tile = within(tiles).getByText("Средняя позиция").closest("li")!;
    expect(within(tile).getByText(/лучше на 3,3/)).toHaveAttribute("data-trend", "better");
  });

  it("names the latest day Search Console has figures for", async () => {
    const user = userEvent.setup();
    api();
    renderWithProviders(<App />, route);
    await openSeo(user);
    expect(await screen.findByText(/Последний день с данными: 4 ноября/)).toBeInTheDocument();
  });

  it("is shown to a client's person, without the check control", async () => {
    const user = userEvent.setup();
    signedInAs("CLIENT");
    api();
    renderWithProviders(<App />, route);
    await openSeo(user);
    expect(await screen.findByRole("region", { name: "Проверка страниц" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Проверить сейчас" })).toBeNull();
  });
});

describe("the SEO view", () => {
  it("shows the lab measurement of the home page as plain numbers per device", async () => {
    const user = userEvent.setup();
    api({ labs: { PHONE: { score: 92, rating: "GOOD", lcpMs: 1800, cls: 0.05, tbtMs: 120, fcpMs: 900, speedIndexMs: 2100 }, DESKTOP: desktopLab } });
    renderWithProviders(<App />, route);
    await openSeo(user);

    const lab = await screen.findByRole("region", { name: "Лабораторный замер главной страницы" });
    expect(screen.queryByRole("region", { name: "Core Web Vitals" })).toBeNull();
    await waitFor(() => expect(within(lab).getByText("Производительность").nextSibling).toHaveTextContent("92"));
    expect(within(lab).getByText("LCP").nextSibling).toHaveTextContent("1,8 с");
    expect(within(lab).getByText("CLS").nextSibling).toHaveTextContent("0,05");
    expect(within(lab).getByText("TBT").nextSibling).toHaveTextContent("120 мс");
    expect(within(lab).getByText("LCP").nextSibling).toHaveAttribute("data-rating", "GOOD");

    await user.click(within(lab).getByRole("radio", { name: "Компьютер" }));

    expect(within(lab).getByText("Производительность").nextSibling).toHaveTextContent("45");
    expect(within(lab).getByText("LCP").nextSibling).toHaveTextContent("4,1 с");
    expect(within(lab).getByText("Speed Index").nextSibling).toHaveTextContent("5,0 с");
    expect(within(lab).getByText("Speed Index").nextSibling).toHaveAttribute("data-rating", "NEEDS_IMPROVEMENT");
    expect(within(lab).getByText("LCP").nextSibling).toHaveAttribute("data-rating", "POOR");
    expect(within(lab).getByText("Производительность").nextSibling).toHaveAttribute("data-rating", "POOR");
  });

  it("shows a loader instead of the numbers while the first measurement is awaited", async () => {
    const user = userEvent.setup();
    api({ sites: [{ ...site, status: "RUNNING", lastSuccessAt: null, checkStatus: "QUEUED", lastCheckAt: null }], labs: {} });
    renderWithProviders(<App />, route);
    await openSeo(user);

    const lab = await screen.findByRole("region", { name: "Лабораторный замер главной страницы" });
    expect(await within(lab).findByRole("status")).toHaveTextContent("Измеряем главную страницу");
    expect(within(lab).queryByText("Производительность")).toBeNull();
  });

  it("says there is no measurement when nothing is running", async () => {
    const user = userEvent.setup();
    api({ labs: {} });
    renderWithProviders(<App />, route);
    await openSeo(user);

    const lab = await screen.findByRole("region", { name: "Лабораторный замер главной страницы" });
    expect(await within(lab).findByText("Замера ещё нет")).toBeInTheDocument();
    expect(within(lab).queryByRole("status")).toBeNull();
  });

  it("ranks the top queries and pages in scrollable lists", async () => {
    const user = userEvent.setup();
    api();
    renderWithProviders(<App />, route);
    await openSeo(user);

    const queries = await screen.findByRole("region", { name: "Запросы" });
    const pages = await screen.findByRole("region", { name: "Страницы" });
    await waitFor(() => expect(within(queries).getAllByRole("listitem")).toHaveLength(12));
    await waitFor(() => expect(within(pages).getAllByRole("listitem")).toHaveLength(12));
    expect(within(queries).getAllByRole("listitem")[0]).toHaveTextContent("запрос 1");
    expect(within(queries).queryByRole("button", { name: "Показать все" })).toBeNull();
    expect(within(pages).queryByRole("button", { name: "Показать все" })).toBeNull();
  });

  it("lists problems by kind, errors first, and opens a page with its JSON-LD", async () => {
    const user = userEvent.setup();
    api();
    renderWithProviders(<App />, route);
    await openSeo(user);

    const audit = await screen.findByRole("region", { name: "Проверка страниц" });
    const kinds = await within(audit).findByRole("list", { name: "Проблемы" });
    expect(within(kinds).getAllByRole("button").map((button) => button.textContent)).toEqual([
      expect.stringContaining("Страница отвечает ошибкой"),
      expect.stringContaining("Нет meta description"),
    ]);

    await user.click(within(kinds).getByRole("button", { name: /Нет meta description/ }));
    await user.click(await within(audit).findByRole("button", { name: /page-1/ }));

    const panel = await screen.findByRole("complementary", { name: "https://site.ru/page-1" });
    expect(within(panel).getByText("Organization")).toBeInTheDocument();
    expect(within(panel).getByText("BreadcrumbList")).toBeInTheDocument();
    expect(within(panel).getByText(/Окна на заказ/)).toBeInTheDocument();
    expect(within(panel).getByText("text/html")).toBeInTheDocument();
    expect(within(panel).getByText("120 мс")).toBeInTheDocument();
  });

  it("opens a checked page from the pages list", async () => {
    const user = userEvent.setup();
    api();
    renderWithProviders(<App />, route);
    await openSeo(user);

    const pages = await screen.findByRole("region", { name: "Страницы" });
    await user.click(await within(pages).findByRole("button", { name: /\/page-1/ }));

    expect(await screen.findByRole("complementary", { name: "https://site.ru/page-1" })).toBeInTheDocument();
  });

  it("starts a page check for a member who manages integrations", async () => {
    const user = userEvent.setup();
    let checked = false;
    api();
    server.use(mock.post(`${seo}/audit`, () => {
      checked = true;
      return HttpResponse.json({ ...site, checkStatus: "QUEUED" }, { status: 202 });
    }));
    renderWithProviders(<App />, route);
    await openSeo(user);

    await user.click(await screen.findByRole("button", { name: "Проверить сейчас" }));

    await waitFor(() => expect(checked).toBe(true));
  });
});

const linked = { propertyId: "111", name: "Acme / site.ru", status: "SUCCESS", lastSuccessAt: "2026-11-07T06:00:00Z", lastError: null };
const traffic = {
  connected: true, propertyName: "Acme / site.ru", status: "SUCCESS", lastSuccessAt: "2026-11-07T06:00:00Z", lastError: null,
  from: "2026-10-08", to: "2026-11-06", totalSessions: 1000, previousSessions: 800,
  channels: [
    { channel: "Organic Search", sessions: 600, share: 0.6, previous: 500 },
    { channel: "Direct", sessions: 400, share: 0.4, previous: 300 },
    { channel: "Paid Search", sessions: 0, share: 0, previous: 70 },
  ],
  sources: [
    { source: "google", medium: "organic", sessions: 600, share: 0.6 },
    { source: "(direct)", medium: "(none)", sessions: 400, share: 0.4 },
  ],
  days: [{ date: "2026-11-03", sessions: 450 }, { date: "2026-11-04", sessions: 550 }],
};

describe("the traffic sources block", () => {
  it("lists the channels with sessions, share and change, and the sources and mediums", async () => {
    const user = userEvent.setup();
    api({ sites: [{ ...site, analytics: linked }], traffic });
    renderWithProviders(<App />, route);
    await openSeo(user);

    const block = await screen.findByRole("region", { name: "Источники трафика" });
    const channels = await within(block).findByRole("region", { name: "Каналы" });
    const items = within(channels).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Поиск");
    expect(items[0]).toHaveTextContent("600");
    expect(items[0]).toHaveTextContent("60,00%");
    expect(items[0]).toHaveTextContent("+20,0%");
    expect(within(items[0]!).getByText(/\+20,0%/)).toHaveAttribute("data-trend", "up");
    expect(items[1]).toHaveTextContent("Прямые заходы");
    const sources = within(block).getByRole("region", { name: "Источники и каналы" });
    expect(within(sources).getAllByRole("listitem")[0]).toHaveTextContent("google / organic");
    expect(within(block).getByText(/Всего сессий/)).toHaveTextContent(/1\s000/);
  });

  it("shows a loader instead of figures while the first import runs", async () => {
    const user = userEvent.setup();
    api({ sites: [{ ...site, analytics: { ...linked, status: "RUNNING", lastSuccessAt: null } }], traffic: { ...traffic, status: "RUNNING", lastSuccessAt: null, totalSessions: 0, channels: [], sources: [], days: [] } });
    renderWithProviders(<App />, route);
    await openSeo(user);

    const block = await screen.findByRole("region", { name: "Источники трафика" });
    expect(await within(block).findByRole("status")).toHaveTextContent("Загружаем данные Google Analytics");
    expect(within(block).queryByRole("region", { name: "Каналы" })).toBeNull();
  });

  it("offers to connect Google Analytics to a member who manages integrations", async () => {
    const user = userEvent.setup();
    api();
    renderWithProviders(<App />, route);
    await openSeo(user);

    const block = await screen.findByRole("region", { name: "Источники трафика" });
    expect(await within(block).findByText(/не подключены/)).toBeInTheDocument();
    expect(within(block).getByRole("button", { name: "Подключить Google Analytics" })).toBeEnabled();
  });

  it("only says traffic is not connected to a client's person", async () => {
    const user = userEvent.setup();
    signedInAs("CLIENT");
    api();
    renderWithProviders(<App />, route);
    await openSeo(user);

    const block = await screen.findByRole("region", { name: "Источники трафика" });
    expect(await within(block).findByText(/не подключены/)).toBeInTheDocument();
    expect(within(block).queryByRole("button")).toBeNull();
  });

  it("says Analytics recorded no sessions", async () => {
    const user = userEvent.setup();
    api({ sites: [{ ...site, analytics: linked }], traffic: { ...traffic, totalSessions: 0, channels: [], sources: [], days: [] } });
    renderWithProviders(<App />, route);
    await openSeo(user);

    const block = await screen.findByRole("region", { name: "Источники трафика" });
    expect(await within(block).findByText(/не записал сессий/)).toBeInTheDocument();
  });

  it("asks to sign in again when Google revoked the access", async () => {
    const user = userEvent.setup();
    api({ sites: [{ ...site, analytics: { ...linked, status: "AUTH_REQUIRED", lastError: "TOKEN" } }], traffic: { ...traffic, status: "AUTH_REQUIRED" } });
    renderWithProviders(<App />, route);
    await openSeo(user);

    const block = await screen.findByRole("region", { name: "Источники трафика" });
    expect(await within(block).findByRole("alert")).toHaveTextContent("Войдите через Google заново");
  });
});
