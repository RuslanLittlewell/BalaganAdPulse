import { http as mock, HttpResponse } from "msw";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders, server } from "@test/shared/index.js";
import { CampaignPage } from "@/pages/campaign/index.js";

const performance = (spend: number, extra = {}) => ({
  spend, impressions: 100000, reach: 40000, clicks: 2000, conversions: 50, revenue: 4000,
  ctr: 2, cpc: 0.5, cpm: 10, cpa: 20, roas: 4, frequency: 2.5, ...extra,
});

const day = (date: string, spend: number) => ({
  date, spend, impressions: 0, reach: 0, clicks: 0, conversions: 0, revenue: 0,
});

function App() {
  return (
    <Routes>
      <Route path="/projects/:projectId/campaigns/:campaignId" element={<CampaignPage />} />
      <Route path="/projects/:projectId" element={<h1>Проект</h1>} />
    </Routes>
  );
}

function api(options: { adSets?: unknown[]; days?: unknown[] } = {}) {
  server.use(
    mock.get("/api/campaigns/:campaignId/daily", () =>
      HttpResponse.json(options.days ?? [day("2026-08-01", 400), day("2026-08-02", 900)])),
    mock.get("/api/campaigns/:campaignId/ad-sets", () => HttpResponse.json(options.adSets ?? [
      { id: "s1", campaignId: "c1", name: "Москва · 28–55", audience: "Гео Москва",
        status: "ACTIVE", externalId: null, position: 0, performance: performance(600) },
    ])),
    mock.get("/api/ad-sets/:adSetId/ads", () => HttpResponse.json([
      { id: "a1", adSetId: "s1", name: "Приём сегодня", format: "Текст", headline: null,
        status: "PAUSED", externalId: null, position: 0, performance: performance(300) },
    ])),
    mock.get("/api/campaigns/:campaignId", () => HttpResponse.json({
      id: "c1", projectId: "p1", name: "Поиск / Москва", channel: "YANDEX", status: "ACTIVE",
      objective: "Заявки", externalId: null, position: 0, performance: performance(1500),
    })),
  );
}

const route = { route: "/projects/p1/campaigns/c1" };

describe("CampaignPage", () => {
  it("names the campaign with its channel and status", async () => {
    api();
    renderWithProviders(<App />, route);

    expect(await screen.findByRole("heading", { name: "Поиск / Москва" })).toBeInTheDocument();
    // Channel, delivery status and objective on one line under the name.
    expect(screen.getByText("Яндекс Директ · Активна · Заявки")).toBeInTheDocument();
  });

  it("returns to the campaign list through the back arrow in the title", async () => {
    const user = userEvent.setup();
    api();
    renderWithProviders(<App />, route);

    await user.click(await screen.findByRole("button", { name: "Назад к кампаниям" }));
    expect(await screen.findByRole("heading", { name: "Проект" })).toBeInTheDocument();
  });

  it("shows the campaign's figures for the period", async () => {
    api();
    renderWithProviders(<App />, route);

    const summary = await screen.findByRole("group", { name: "Показатели за период" });
    expect(await within(summary).findByText("1 500 ₽")).toBeInTheDocument();
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
    expect(within(row).getByText("600 ₽")).toBeInTheDocument();
  });

  // Ads live under their ad set. Loading them all up front would be a request
  // per set for rows nobody has asked to see.
  it("reveals the ads inside an ad set when it is expanded", async () => {
    const user = userEvent.setup();
    api();
    renderWithProviders(<App />, route);

    await user.click(await screen.findByRole("button", { name: /Москва · 28–55/ }));

    expect(await screen.findByText("Приём сегодня")).toBeInTheDocument();
  });

  it("says so when the campaign has no ad sets", async () => {
    api({ adSets: [] });
    renderWithProviders(<App />, route);

    expect(await screen.findByText("Групп объявлений пока нет")).toBeInTheDocument();
  });
});
