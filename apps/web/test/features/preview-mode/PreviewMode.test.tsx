import { http as mock, HttpResponse } from "msw";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { clearTokens, writeTokens } from "@/shared/lib/index.js";
import { aClient, aProject, makeAccessToken, server } from "@test/shared/index.js";
import { App } from "@/app/App.js";

const performance = {
  spend: 3000, impressions: 100000, reach: 40000, clicks: 2000, conversions: 50, results: 0, revenue: 4000,
  ctr: 2, cpc: 1.5, cpm: 30, cpa: 60, costPerResult: null, roas: 1.3, frequency: 2.5,
};

function serve() {
  server.use(
    mock.get("/api/clients", () => HttpResponse.json([
      aClient({ id: "cl1", name: "Acme" }),
      aClient({ id: "cl2", name: "Другой клиент" }),
    ])),
    mock.get("/api/projects", () => HttpResponse.json([
      aProject({ id: "p1", clientId: "cl1", name: "Клиника", budgetCurrency: "BYN" }),
      aProject({ id: "p2", clientId: "cl1", name: "Салон", budgetCurrency: "BYN" }),
      aProject({ id: "p3", clientId: "cl2", name: "Чужой проект", budgetCurrency: "BYN" }),
    ])),
    mock.get("/api/projects/:projectId/summary", () => HttpResponse.json(performance)),
    mock.get("/api/projects/:projectId/summary-tiles", () => HttpResponse.json({ tiles: ["SPEND", "KPI"] })),
    mock.get("/api/projects/:projectId/kpis", () => HttpResponse.json([
      { id: "k1", metric: "CONVERSIONS", target: "60.0000", enabled: true, updatedAt: "2026-10-01T00:00:00.000Z" },
    ])),
    mock.get("/api/projects/:projectId/campaigns", () => HttpResponse.json([{
      id: "c1", projectId: "p1", name: "Поиск / Москва", channel: "META", status: "ACTIVE", objective: null,
      externalId: null, sourceAccountId: null, position: 0, kpi: null, performance, resultTypes: [],
    }])),
    mock.get("/api/campaigns/:campaignId", () => HttpResponse.json({
      id: "c1", projectId: "p1", name: "Поиск / Москва", channel: "META", status: "ACTIVE", objective: null,
      externalId: null, sourceAccountId: null, position: 0, kpi: null, performance, resultTypes: [],
    })),
    mock.get("/api/campaigns/:campaignId/daily", () => HttpResponse.json([])),
    mock.get("/api/campaigns/:campaignId/ad-sets", () => HttpResponse.json([])),
    mock.get("/api/campaigns/names", () => HttpResponse.json([])),
    mock.get("/api/tasks", () => HttpResponse.json([])),
  );
}

function renderAppAt(path: string) {
  window.history.pushState({}, "", path);
  return render(<App />);
}

beforeEach(() => {
  clearTokens();
  writeTokens({ accessToken: makeAccessToken(), refreshToken: "r" });
  serve();
});

const inPreview = () => new URLSearchParams(window.location.search).get("preview") === "1";

describe("showing a project in preview", () => {
  it("leaves only the metrics, the tiles and the campaign table", async () => {
    const user = userEvent.setup();
    renderAppAt("/projects/p1");
    expect(await screen.findByRole("heading", { name: "Клиника" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Задачи/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Превью" }));

    expect(await screen.findByRole("button", { name: "Выйти из превью" })).toBeInTheDocument();
    expect(inPreview()).toBe(true);
    expect(screen.getByRole("heading", { name: "Метрики" })).toBeInTheDocument();
    expect(await screen.findByRole("row", { name: /Поиск \/ Москва/ })).toBeInTheDocument();
    expect(screen.getByText("KPI · Лиды")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Клиника" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Задачи/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Салон")).not.toBeInTheDocument();
    expect(screen.queryByText("Задачи в работе")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Превью" })).not.toBeInTheDocument();
  });

  it("offers nothing that changes the tiles or the KPIs", async () => {
    renderAppAt("/projects/p1?preview=1");

    expect(await screen.findByText("KPI · Лиды")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Настроить показатели" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Изменить цель|Задать цель/ })).not.toBeInTheDocument();
  });

  it("opens straight in preview from its address", async () => {
    renderAppAt("/projects/p1?preview=1");

    expect(await screen.findByRole("button", { name: "Выйти из превью" })).toBeInTheDocument();
    expect(await screen.findByRole("row", { name: /Поиск \/ Москва/ })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Клиника" })).not.toBeInTheDocument();
  });

  it("stays in preview when a campaign is opened", async () => {
    const user = userEvent.setup();
    renderAppAt("/projects/p1?preview=1");

    await user.click(await screen.findByRole("button", { name: /Поиск \/ Москва/ }));

    expect(await screen.findByRole("heading", { name: "Поиск / Москва" })).toBeInTheDocument();
    expect(inPreview()).toBe(true);
    expect(screen.getByRole("button", { name: "Выйти из превью" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Задачи/ })).not.toBeInTheDocument();
  });

  it("shows the whole page again once left", async () => {
    const user = userEvent.setup();
    renderAppAt("/projects/p1?preview=1");

    await user.click(await screen.findByRole("button", { name: "Выйти из превью" }));

    expect(await screen.findByRole("heading", { name: "Клиника" })).toBeInTheDocument();
    expect(inPreview()).toBe(false);
    expect(screen.getByRole("link", { name: /Задачи/ })).toBeInTheDocument();
    await waitFor(() => expect(within(document.body).getByRole("button", { name: "Превью" })).toBeInTheDocument());
  });

  it("names the shown project in a select of its client's projects only", async () => {
    const user = userEvent.setup();
    renderAppAt("/projects/p1?preview=1");

    const select = await screen.findByRole("combobox", { name: "Проект" });
    await waitFor(() => expect(select).toHaveTextContent("Клиника"));
    await user.click(select);

    const options = await screen.findAllByRole("option");
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent("Клиника");
    expect(options[1]).toHaveTextContent("Салон");
    expect(screen.queryByRole("option", { name: /Чужой проект/ })).not.toBeInTheDocument();
  });

  it("opens another project of the client in preview for the same period", async () => {
    const user = userEvent.setup();
    renderAppAt("/projects/p1?from=2026-09-01&to=2026-09-30&preview=1");

    await user.click(await screen.findByRole("combobox", { name: "Проект" }));
    await user.click(await screen.findByRole("option", { name: /Салон/ }));

    await waitFor(() => expect(window.location.pathname).toBe("/projects/p2"));
    const params = new URLSearchParams(window.location.search);
    expect(params.get("preview")).toBe("1");
    expect(params.get("from")).toBe("2026-09-01");
    expect(params.get("to")).toBe("2026-09-30");
    expect(await screen.findByRole("combobox", { name: "Проект" })).toHaveTextContent("Салон");
  });

  it("offers the projects select on a campaign page too", async () => {
    renderAppAt("/projects/p1/campaigns/c1?preview=1");

    expect(await screen.findByRole("combobox", { name: "Проект" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Выйти из превью" })).toBeInTheDocument();
  });

  it("is ignored outside a project's pages", async () => {
    renderAppAt("/?preview=1");

    expect(await screen.findByRole("link", { name: /Задачи/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Выйти из превью" })).not.toBeInTheDocument();
  });
});
