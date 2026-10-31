import { http, HttpResponse } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { aClient, aProject, renderWithProviders, server } from "@test/shared/index.js";
import { ProjectsPage } from "@/pages/projects/ProjectsPage.js";
import { writeProjectListCollapsed } from "@/shared/lib/index.js";

const acme = aClient({ id: "1", name: "Acme" });
const summer = aProject({ id: "p1", clientId: "1", name: "Летний запуск" });
const winter = aProject({ id: "p2", clientId: "1", name: "Зимняя распродажа" });

function setup(route = "/projects/p1") {
  server.use(
    http.get("/api/clients", () => HttpResponse.json([acme])),
    http.get("/api/projects", () => HttpResponse.json([summer, winter])),
    http.get("/api/projects/:id/campaigns", () => HttpResponse.json([])),
  );
  return renderWithProviders(
    <Routes>
      <Route path="/projects/*" element={<ProjectsPage />} />
    </Routes>,
    { route },
  );
}

beforeEach(() => {
  localStorage.removeItem("adpulse.projects.collapsed");
  vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
    matches: query.startsWith("not all and (min-width:"),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const picker = (name: string) => screen.findByRole("button", { name });

describe("the project list on a narrow screen", () => {
  it("names the chosen project and its client on a button, the list closed", async () => {
    setup();

    const button = await picker("Список проектов: Летний запуск");
    await waitFor(() => expect(button).toHaveTextContent("Acme"));
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("searchbox", { name: "Поиск проектов" })).not.toBeInTheDocument();
  });

  it("asks for a project while none is chosen", async () => {
    setup("/projects");

    expect(await picker("Список проектов")).toHaveTextContent("Выберите проект");
  });

  it("opens the whole list with its search and the create button", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(await picker("Список проектов: Летний запуск"));

    const list = await screen.findByRole("dialog", { name: "Список проектов" });
    expect(within(list).getByRole("searchbox", { name: "Поиск проектов" })).toBeInTheDocument();
    expect(within(list).getByRole("button", { name: "Новый проект" })).toBeInTheDocument();
    expect(await within(list).findByText("Зимняя распродажа")).toBeInTheDocument();
  });

  it("opens the project chosen in the list and closes it", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(await picker("Список проектов: Летний запуск"));
    const list = await screen.findByRole("dialog", { name: "Список проектов" });
    await user.click(await within(list).findByText("Зимняя распродажа"));

    expect(await screen.findByRole("heading", { name: "Зимняя распродажа" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Список проектов" })).not.toBeInTheDocument();
    expect(await picker("Список проектов: Зимняя распродажа")).toBeInTheDocument();
  });

  it("shows each project's name though the list was collapsed on a wide screen", async () => {
    const user = userEvent.setup();
    writeProjectListCollapsed(true);
    setup();

    await user.click(await picker("Список проектов: Летний запуск"));
    const list = await screen.findByRole("dialog", { name: "Список проектов" });

    expect(await within(list).findByText("Зимняя распродажа")).toBeInTheDocument();
    expect(within(list).getByText("Летний запуск")).toBeInTheDocument();
  });
});
