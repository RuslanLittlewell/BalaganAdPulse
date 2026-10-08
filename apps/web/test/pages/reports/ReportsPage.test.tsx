import { http as mock, HttpResponse } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders, server } from "@test/shared/index.js";
import { ReportsPage } from "@/pages/reports/index.js";
import { ProjectPage } from "@/pages/project/index.js";

const project = (id: string, name: string) => ({
  id, clientId: "cl1", name, budgetCurrency: "USD", priority: "NEW", image: null, avatarPath: null, position: 0, createdAt: "", updatedAt: "",
});

const summary = (id: string, projectId: string, month: string, status = "PUBLISHED") => ({
  id, projectId, month, status, currency: "USD", spend: "3080.7700", leads: 95, costPerLead: "32.4292", publishedAt: null,
});

const created9 = {
  id: "r9", projectId: "p1", month: "2026-07", status: "DRAFT", currency: "USD",
  spend: "0.0000", leads: 0, costPerLead: null, previous: null, change: { leads: null, costPerLead: null },
  trend: [{ month: "2026-07", spend: "0.0000", leads: 0, costPerLead: null }], ads: [],
  messengerContacts: null, hasCover: false, conclusions: null, plan: null, publishedAt: null, createdAt: "", updatedAt: "",
  computedAt: "2026-10-05T09:00:00.000Z", computedLeads: 0, leadsOverride: null, runningAds: [],
};

function App() {
  return (
    <Routes>
      <Route path="/reports/*" element={<ReportsPage />} />
      <Route path="/projects/:projectId" element={<ProjectPage />} />
    </Routes>
  );
}

function api() {
  const listed: Array<string | null> = [];
  server.use(
    mock.get("/api/projects", () => HttpResponse.json([project("p1", "Окна"), project("p2", "Перегородки")])),
    mock.get("/api/clients", () => HttpResponse.json([{ id: "cl1", name: "AURORA", orgId: "o1" }])),
    mock.get("/api/reports", ({ request }) => {
      const projectId = new URL(request.url).searchParams.get("projectId");
      listed.push(projectId);
      const all = [summary("r2", "p2", "2026-08", "DRAFT"), summary("r1", "p1", "2026-08")];
      return HttpResponse.json(projectId ? all.filter((entry) => entry.projectId === projectId) : all);
    }),
  );
  return listed;
}

const asClient = () => server.use(mock.get("/api/auth/me", () => HttpResponse.json({
  user: { id: "user-9", name: "Клиент", email: "client@acme.com", image: null },
  organization: { id: "org-1", name: "AdPulse", slug: "adpulse" },
  role: "CLIENT", clientIds: ["cl1"],
})));

const rows = () => within(screen.getByRole("table", { name: "Список отчётов" })).getAllByRole("row").slice(1);

describe("ReportsPage", () => {
  it("lists reports across projects with their status for staff and filters by project", async () => {
    const listed = api();
    const user = userEvent.setup();
    renderWithProviders(<App />, { route: "/reports" });

    expect(await screen.findByRole("heading", { name: "Отчёты" })).toBeInTheDocument();
    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(rows()[0]).toHaveTextContent("Август 2026Перегородки");
    expect(rows()[0]).toHaveTextContent("Черновик");
    expect(within(rows()[1]!).getByRole("link", { name: "Август 2026" })).toHaveAttribute("href", "/reports/r1");

    await user.click(screen.getByRole("combobox", { name: "Фильтр по проекту" }));
    await user.click(await screen.findByRole("option", { name: "Окна" }));

    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(rows()[0]).toHaveTextContent("Окна");
    expect(listed).toContain("p1");
  });

  it("shows a client the reports without status or a create control", async () => {
    asClient();
    api();
    renderWithProviders(<App />, { route: "/reports" });

    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(screen.queryByText("Опубликован")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Новый отчёт" })).not.toBeInTheDocument();
  });

  it("creates a report for a chosen project and an available month, then opens it", async () => {
    api();
    let created: unknown;
    server.use(
      mock.get("/api/projects/p1/reports", () => HttpResponse.json({ reports: [], available: ["2026-08", "2026-07"] })),
      mock.post("/api/projects/p1/reports", async ({ request }) => {
        created = await request.json();
        return HttpResponse.json(created9, { status: 201 });
      }),
      mock.get("/api/reports/r9", () => HttpResponse.json(created9)),
      mock.get("/api/ads/:adId/creatives", () => HttpResponse.json([])),
    );
    const user = userEvent.setup();
    renderWithProviders(<App />, { route: "/reports" });

    await user.click(await screen.findByRole("button", { name: "Новый отчёт" }));
    const dialog = await screen.findByRole("dialog", { name: "Новый отчёт" });
    expect(within(dialog).getByRole("button", { name: "Сформировать" })).toBeDisabled();
    await user.click(within(dialog).getByRole("combobox", { name: "Проект" }));
    await user.click(await screen.findByRole("option", { name: "Окна" }));
    await user.click(within(dialog).getByRole("combobox", { name: "Месяц" }));
    expect((await screen.findAllByRole("option")).map((option) => option.textContent)).toEqual(["Август 2026", "Июль 2026"]);
    await user.click(screen.getByRole("option", { name: "Июль 2026" }));
    await user.click(within(dialog).getByRole("button", { name: "Сформировать" }));

    expect(await screen.findByRole("heading", { name: "Отчёт по рекламе · Июль 2026" })).toBeInTheDocument();
    expect(screen.getByText("Окна", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Скачать PDF" })).toBeInTheDocument();
    expect(created).toEqual({ month: "2026-07" });
  });

  it("leaves reports off the project page", async () => {
    api();
    let asked = false;
    server.use(
      mock.get("/api/projects/:projectId/reports", () => { asked = true; return HttpResponse.json({ reports: [], available: [] }); }),
      mock.get("/api/projects/:projectId/summary", () => HttpResponse.json(null)),
      mock.get("/api/projects/:projectId/kpi", () => HttpResponse.json(null)),
      mock.get("/api/tasks", () => HttpResponse.json([])),
    );
    renderWithProviders(<App />, { route: "/projects/p1" });

    expect(await screen.findByText("Окна")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Отчёты" })).not.toBeInTheDocument();
    expect(asked).toBe(false);
  });
});
