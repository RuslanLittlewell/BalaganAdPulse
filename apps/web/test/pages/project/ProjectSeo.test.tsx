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
  lastError: null, checkStatus: "SUCCESS", lastCheckAt: "2026-11-05T06:00:00Z", checkError: null,
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

function api(options: { sites?: unknown[]; checkStatus?: string } = {}) {
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
      devices: [
        {
          device: "PHONE", periodEnd: "2026-11-05", passes: true,
          metrics: [
            { metric: "LCP", p75: 2100, rating: "GOOD", good: 0.8, needsImprovement: 0.15, poor: 0.05, weeks: [] },
            { metric: "INP", p75: 150, rating: "GOOD", good: 0.9, needsImprovement: 0.08, poor: 0.02, weeks: [] },
            { metric: "CLS", p75: 0.05, rating: "GOOD", good: 0.95, needsImprovement: 0.03, poor: 0.02, weeks: [] },
          ],
          lab: null,
        },
        {
          device: "DESKTOP", periodEnd: null, passes: null, metrics: [],
          lab: { device: "DESKTOP", measuredAt: "2026-11-05T06:00:00Z", score: 45, rating: "POOR", lcpMs: 4100, cls: 0.2, tbtMs: 600, fcpMs: 2000, speedIndexMs: 5000 },
        },
      ],
    })),
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
  it("rates Core Web Vitals per device and says whether the site passes", async () => {
    const user = userEvent.setup();
    api();
    renderWithProviders(<App />, route);
    await openSeo(user);

    const vitals = await screen.findByRole("region", { name: "Core Web Vitals" });
    expect(await within(vitals).findByText("Сайт проходит Core Web Vitals")).toBeInTheDocument();
    expect(within(vitals).getByRole("listitem", { name: /LCP: 2,1.с, Хорошо/ })).toBeInTheDocument();

    await user.click(within(vitals).getByRole("radio", { name: "Компьютер" }));

    expect(within(vitals).getByText(/слишком мало визитов/)).toBeInTheDocument();
    expect(within(vitals).getByRole("region", { name: "Лабораторный замер главной страницы" })).toHaveTextContent("45");
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
