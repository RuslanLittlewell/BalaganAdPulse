import { http as mock, HttpResponse } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, server } from "@test/shared/index.js";
import { DashboardPage } from "@/pages/dashboard/index.js";
import { Route, Routes, useLocation } from "react-router-dom";

function ProjectDestination() {
  const location = useLocation();
  return <><h2>Экран проекта</h2><output>{location.search}</output></>;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/projects/:projectId" element={<ProjectDestination />} />
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
    expect(await within(summary).findByText("50")).toBeInTheDocument();
    expect(within(summary).getByText("Лиды")).toBeInTheDocument();
    expect(within(summary).getByText(/^CPL 20,00/)).toBeInTheDocument();
    expect(screen.getByLabelText("От")).toBeInTheDocument();
    expect(screen.getByLabelText("До")).toBeInTheDocument();
  });

  it("calls the lead figure Лиды and its cost CPL in the summary", async () => {
    api();
    renderWithProviders(<DashboardPage />);

    const summary = await screen.findByRole("group", { name: "Показатели за период" });
    expect(await within(summary).findByText("Лиды")).toBeInTheDocument();
    expect(within(summary).getByText(/^CPL /)).toBeInTheDocument();
    expect(within(summary).queryByText("Конверсии")).toBeNull();
    expect(within(summary).queryByText(/^CPA /)).toBeNull();
  });

  it("offers the agency KPI to an admin and not to a guest", async () => {
    api();
    server.use(mock.get("/api/organization/kpi", () => HttpResponse.json(null)));
    const { unmount } = renderWithProviders(<DashboardPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Настроить показатели" }));
    const dialog = await screen.findByRole("dialog", { name: "Показатели за период" });
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "KPI" })).toBeInTheDocument());
    unmount();

    server.use(mock.get("/api/auth/me", () => HttpResponse.json({
      user: { id: "user-1", name: "Guest", email: "guest@acme.com", image: null },
      organization: { id: "org-1", name: "AdPulse", slug: "adpulse" },
      role: "GUEST",
      clientIds: [],
    })));
    renderWithProviders(<DashboardPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Настроить показатели" }));
    const guestDialog = await screen.findByRole("dialog", { name: "Показатели за период" });
    await within(guestDialog).findByRole("button", { name: "Лиды" });
    expect(within(guestDialog).queryByRole("button", { name: "KPI" })).not.toBeInTheDocument();
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

  it("keeps the selected range when a project is opened", async () => {
    const user = userEvent.setup();
    api();
    renderWithProviders(<App />, { route: "/?from=2026-08-01&to=2026-08-09" });

    await user.click(await screen.findByRole("button", { name: /Клиника/ }));

    expect(await screen.findByText("?from=2026-08-01&to=2026-08-09")).toBeInTheDocument();
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
