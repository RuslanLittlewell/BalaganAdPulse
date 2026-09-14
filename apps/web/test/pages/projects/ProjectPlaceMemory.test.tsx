import { http as mock, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import { aClient, aProject, renderWithProviders, server } from "@test/shared/index.js";
import { ProjectsPage } from "@/pages/projects/ProjectsPage.js";
import { useModuleMemory } from "@/shared/lib/index.js";

const performance = {
  spend: 1500, impressions: 100000, reach: 40000, clicks: 2000, conversions: 50, revenue: 4000,
  ctr: 2, cpc: 0.5, cpm: 10, cpa: 20, roas: 4, frequency: 2.5,
};

function Address() {
  const location = useLocation();
  return <output aria-label="Адрес">{`${location.pathname}${location.search}`}</output>;
}

function App() {
  return (
    <>
      <nav>
        <Link to="/projects">Проекты</Link>
        <Link to="/tasks">Задачи</Link>
      </nav>
      <Address />
      <Routes>
        <Route path="/projects/*" element={<ProjectsPage />} />
        <Route path="/tasks" element={<h1>Модуль задач</h1>} />
      </Routes>
    </>
  );
}

function api(projects = [aProject({ id: "p1", clientId: "1", name: "Летний запуск" })]) {
  server.use(
    mock.get("/api/clients", () => HttpResponse.json([aClient({ id: "1", name: "Acme" })])),
    mock.get("/api/projects", () => HttpResponse.json(projects)),
    mock.get("/api/members", () => HttpResponse.json([])),
    mock.get("/api/tasks", () => HttpResponse.json([])),
    mock.get("/api/projects/:projectId/summary", () => HttpResponse.json(performance)),
    mock.get("/api/projects/:projectId/campaigns", () => HttpResponse.json([])),
    mock.get("/api/campaigns/:campaignId", () => HttpResponse.json({
      id: "c1", projectId: "p1", name: "Поиск / Москва", channel: "YANDEX", status: "ACTIVE",
      objective: null, externalId: null, position: 0, performance,
    })),
    mock.get("/api/campaigns/:campaignId/daily", () => HttpResponse.json([])),
    mock.get("/api/campaigns/:campaignId/ad-sets", () => HttpResponse.json([])),
  );
}

const address = () => screen.getByLabelText("Адрес");

async function leaveAndReturn() {
  await userEvent.click(screen.getByRole("link", { name: "Задачи" }));
  await screen.findByRole("heading", { name: "Модуль задач" });
  await userEvent.click(screen.getByRole("link", { name: "Проекты" }));
}

const signedInAs = (id: string) => server.use(mock.get("/api/auth/me", () => HttpResponse.json({
  user: { id, name: "Buyer", email: `${id}@acme.com`, image: null },
  organization: { id: "org-1", name: "AdPulse", slug: "adpulse" },
  role: "ADMIN",
  clientIds: [],
})));

describe("the place a member last had open in the projects module", () => {
  it("reopens the campaign with its period", async () => {
    api();
    renderWithProviders(<App />, { route: "/projects/p1/campaigns/c1?from=2026-08-01&to=2026-08-31" });
    await screen.findByRole("heading", { name: "Поиск / Москва" });

    await leaveAndReturn();

    expect(await screen.findByRole("heading", { name: "Поиск / Москва" })).toBeInTheDocument();
    expect(address()).toHaveTextContent("/projects/p1/campaigns/c1?from=2026-08-01&to=2026-08-31");
  });

  it("reopens the project a member moved to last", async () => {
    api();
    renderWithProviders(<App />, { route: "/projects/p1/campaigns/c1" });
    await screen.findByRole("heading", { name: "Поиск / Москва" });
    await userEvent.click(screen.getByRole("button", { name: "Назад к кампаниям" }));
    await screen.findByRole("heading", { name: "Летний запуск" });

    await leaveAndReturn();

    expect(await screen.findByRole("heading", { name: "Летний запуск" })).toBeInTheDocument();
    await waitFor(() => expect(address()).toHaveTextContent(/^\/projects\/p1(\?.*)?$/));
  });

  it("survives a reload", async () => {
    api();
    useModuleMemory.setState({ projectPlaces: { "user-1": "/projects/p1" } });
    renderWithProviders(<App />, { route: "/projects" });

    expect(await screen.findByRole("heading", { name: "Летний запуск" })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("adpulse-module-memory")!).state.projectPlaces).toMatchObject({ "user-1": expect.stringMatching(/^\/projects\/p1/) });
  });

  it("shows the unselected state and forgets a project the member no longer reaches", async () => {
    api();
    useModuleMemory.setState({ projectPlaces: { "user-1": "/projects/gone/campaigns/c9?from=2026-08-01&to=2026-08-31" } });
    renderWithProviders(<App />, { route: "/projects" });

    expect(await screen.findByText("Проект не выбран")).toBeInTheDocument();
    expect(address()).toHaveTextContent(/^\/projects$/);
    await waitFor(() => expect(useModuleMemory.getState().projectPlaces["user-1"]).toBeUndefined());
  });

  it("does not reopen another person's place", async () => {
    api();
    useModuleMemory.setState({ projectPlaces: { "user-1": "/projects/p1" } });
    signedInAs("user-2");
    renderWithProviders(<App />, { route: "/projects" });

    expect(await screen.findByText("Проект не выбран")).toBeInTheDocument();
    expect(address()).toHaveTextContent(/^\/projects$/);
    expect(useModuleMemory.getState().projectPlaces).toEqual({ "user-1": "/projects/p1" });
  });

  it("shows the unselected state when nothing is remembered", async () => {
    api();
    renderWithProviders(<App />, { route: "/projects" });

    expect(await screen.findByText("Проект не выбран")).toBeInTheDocument();
    expect(address()).toHaveTextContent(/^\/projects$/);
  });
});
