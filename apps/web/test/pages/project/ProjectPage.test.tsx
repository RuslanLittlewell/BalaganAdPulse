import { http as mock, HttpResponse } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { aTask, renderWithProviders, server } from "@test/shared/index.js";
import { ProjectPage } from "@/pages/project/index.js";

const performance = (spend: number, extra = {}) => ({
  spend, impressions: 100000, reach: 40000, clicks: 2000, conversions: 50, revenue: 4000,
  ctr: 2, cpc: 0.5, cpm: 10, cpa: 20, roas: 4, frequency: 2.5, ...extra,
});

const campaign = (id: string, name: string, channel: string, spend: number) => ({
  id, projectId: "p1", name, channel, status: "ACTIVE", objective: null,
  externalId: null, position: 0, performance: performance(spend),
});

function App() {
  return (
    <Routes>
      <Route path="/projects/:projectId" element={<ProjectPage />} />
      <Route path="/projects/:projectId/campaigns/:campaignId" element={<h2>Экран кампании</h2>} />
    </Routes>
  );
}

function api(options: { campaigns?: unknown[]; tasks?: unknown[] } = {}) {
  server.use(
    mock.get("/api/members", () => HttpResponse.json([])),
    mock.get("/api/tasks", () => HttpResponse.json(options.tasks ?? [])),
    mock.get("/api/projects", () => HttpResponse.json([{
      id: "p1", clientId: "cl1", name: "Клиника", niche: "Медицина", monthlyBudget: "300000.0000",
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
  it("shows the project's figures for the period", async () => {
    api();
    renderWithProviders(<App />, route);

    const summary = await screen.findByRole("group", { name: "Показатели за период" });
    expect(within(summary).getByText("4 200 ₽")).toBeInTheDocument();
  });

  it("lists the project's campaigns with their channel", async () => {
    api();
    renderWithProviders(<App />, route);

    const row = await screen.findByRole("row", { name: /Поиск \/ Москва/ });
    // Channel and delivery status share one line under the name.
    expect(within(row).getByText("Яндекс Директ · Активна")).toBeInTheDocument();
    expect(within(row).getByText("3 000 ₽")).toBeInTheDocument();
  });

  it("marks bad, stable and profitable campaign names with red, blue and green borders", async () => {
    api({ campaigns: [
      { ...campaign("bad", "Плохая", "META", 1000), performance: performance(1000, { roas: 0.7 }) },
      { ...campaign("stable", "Стабильная", "GOOGLE", 1000), performance: performance(1000, { roas: 1 }) },
      { ...campaign("good", "Прибыльная", "YANDEX", 1000), performance: performance(1000, { roas: 2 }) },
    ] });
    renderWithProviders(<App />, route);

    expect(await screen.findByRole("button", { name: /Плохая/ })).toHaveClass("border-red-500");
    expect(screen.getByRole("button", { name: /Стабильная/ })).toHaveClass("border-blue-500");
    expect(screen.getByRole("button", { name: /Прибыльная/ })).toHaveClass("border-emerald-500");
  });

  // The totals row is the project's own summed range, not the rows added up:
  // a ROAS of 3 cannot be recovered by averaging two campaigns' 4s.
  it("shows the project's own total under the campaigns", async () => {
    api();
    renderWithProviders(<App />, route);

    const footer = await screen.findByRole("row", { name: /Итого/ });
    expect(within(footer).getByText("4 200 ₽")).toBeInTheDocument();
    expect(within(footer).getByText("3,00x")).toBeInTheDocument();
  });

  it("opens a campaign when its row is chosen", async () => {
    const user = userEvent.setup();
    api();
    renderWithProviders(<App />, route);

    await user.click(await screen.findByRole("button", { name: /Поиск \/ Москва/ }));

    expect(await screen.findByRole("heading", { name: "Экран кампании" })).toBeInTheDocument();
  });

  // Campaigns arrive from the connected accounts, so an empty project is the
  // ordinary state before ingestion — not an error and not a prompt to create one.
  it("says so when the project has no campaigns yet", async () => {
    api({ campaigns: [] });
    renderWithProviders(<App />, route);

    expect(await screen.findByText("Кампаний пока нет")).toBeInTheDocument();
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

  // Editing and deleting a project live in the project list, not here.
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

  // The list answers "what is being worked on", not "what has ever existed".
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
