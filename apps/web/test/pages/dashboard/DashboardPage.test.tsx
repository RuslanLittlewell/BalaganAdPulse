import { http as mock, HttpResponse } from "msw";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, server } from "@test/shared/index.js";
import { DashboardPage } from "@/pages/dashboard/index.js";
import { Route, Routes } from "react-router-dom";

function App() {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/projects/:projectId" element={<h2>Экран проекта</h2>} />
    </Routes>
  );
}

const performance = (spend: number, extra = {}) => ({
  spend, impressions: 100000, reach: 40000, clicks: 2000, conversions: 50, revenue: 4000,
  ctr: 2, cpc: 0.5, cpm: 10, cpa: 20, roas: 4, frequency: 2.5, ...extra,
});

const project = (id: string, name: string) => ({
  id, clientId: "cl1", name, niche: null, monthlyBudget: null, budgetCurrency: "BYN", priority: "NEW",
  image: null, avatarPath: null, position: 0, createdAt: "", updatedAt: "",
});

function api(options: { projects?: unknown[]; agency?: unknown; channels?: unknown[] } = {}) {
  server.use(
    mock.get("/api/projects", () =>
      HttpResponse.json(options.projects ?? [project("p1", "Клиника"), project("p2", "Автосалон")])),
    mock.get("/api/summary", () => HttpResponse.json(options.agency ?? performance(4200))),
    mock.get("/api/summary/channels", () => HttpResponse.json(options.channels ?? [
      { channel: "YANDEX", campaigns: 3, performance: performance(3000) },
      { channel: "META", campaigns: 1, performance: performance(1200) },
    ])),
    mock.get("/api/projects/:projectId/summary", ({ params }) =>
      HttpResponse.json(performance(params.projectId === "p1" ? 3000 : 1200))),
    mock.get("/api/projects/:projectId/daily", () => HttpResponse.json([
      { date: "2026-08-01", spend: 400, impressions: 0, reach: 0, clicks: 0, conversions: 0, revenue: 0 },
      { date: "2026-08-02", spend: 900, impressions: 0, reach: 0, clicks: 0, conversions: 0, revenue: 0 },
    ])),
  );
}

describe("DashboardPage", () => {
  it("shows the agency's figures for the period", async () => {
    api();
    renderWithProviders(<DashboardPage />);

    const summary = await screen.findByRole("group", { name: "Показатели за период" });
    expect(await within(summary).findByText("4 200 ₽")).toBeInTheDocument();
    expect(within(summary).getByText("Расход")).toBeInTheDocument();
  });

  it("lists every project with its own figures", async () => {
    api();
    renderWithProviders(<DashboardPage />);

    const row = await screen.findByRole("row", { name: /Клиника/ });
    expect(within(row).getByText("3 000 Br")).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /Автосалон/ })).toBeInTheDocument();
  });

  it("draws each project's shape over the period", async () => {
    api();
    renderWithProviders(<DashboardPage />);

    await screen.findByRole("row", { name: /Клиника/ });
    expect(await screen.findAllByRole("img", { name: /Расход по дням/ })).toHaveLength(2);
  });

  it("opens a project when its row is chosen", async () => {
    const user = userEvent.setup();
    api();
    renderWithProviders(<App />);

    await user.click(await screen.findByRole("button", { name: /Клиника/ }));

    expect(await screen.findByRole("heading", { name: "Экран проекта" })).toBeInTheDocument();
  });

  it("shows where the money went, by channel", async () => {
    api();
    renderWithProviders(<DashboardPage />);

    expect(await screen.findByText("Яндекс Директ")).toBeInTheDocument();
    expect(screen.getByText("Meta")).toBeInTheDocument();
  });

  it("says so when no channel has been measured", async () => {
    api({ channels: [] });
    renderWithProviders(<DashboardPage />);

    expect(await screen.findByText("Пока нет данных по источникам")).toBeInTheDocument();
  });

  it("says so when there are no projects at all", async () => {
    api({ projects: [] });
    renderWithProviders(<DashboardPage />);

    expect(await screen.findByText("Проектов пока нет")).toBeInTheDocument();
  });
});
