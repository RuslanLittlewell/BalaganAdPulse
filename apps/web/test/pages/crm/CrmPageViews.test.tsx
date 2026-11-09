import { http as mock, HttpResponse } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { aLead, renderWithProviders, server } from "@test/shared/index.js";
import { CrmPage } from "@/pages/crm/index.js";
import { CrmLayout } from "@/pages/crm/index.js";
import { Route, Routes } from "react-router-dom";
import { useModuleMemory } from "@/shared/lib/index.js";

const capabilities = { create: true, update: true, delete: true };
const boards = [
  { key: "project-1", label: "Сайт", capabilities },
  { key: "client-1", label: "Клиент", capabilities },
];

function setup() {
  return renderWithProviders(<Routes><Route path="/crm" element={<CrmLayout />}><Route index element={<CrmPage />} /></Route></Routes>, { route: "/crm" });
}

const sessionOf = (userId: string) => ({
  user: { id: userId, name: "Админ", email: "a@acme.com", image: null },
  organization: { id: "org-1", name: "AdPulse", slug: "adpulse" },
  role: "ADMIN",
  clientIds: [],
});

beforeEach(() => {
  useModuleMemory.setState({ crmViews: {}, boards: {} });
  server.use(
    mock.get("/api/crm/boards", () => HttpResponse.json(boards)),
    mock.get("/api/crm/boards/:board/leads", ({ params }) =>
      HttpResponse.json(params.board === "project-1" ? [aLead({ id: "lead-1", name: "Анна" })] : [])),
    mock.get("/api/tasks", () => HttpResponse.json([])),
  );
});

const layouts = () => screen.findByRole("radiogroup", { name: "Раскладка" });

async function choose(name: string) {
  await userEvent.click(within(await layouts()).getByRole("radio", { name }));
}

const onTasks = () => screen.queryByRole("button", { name: "Следующая неделя" }) !== null;
const onBoard = () => screen.queryByRole("region", { name: "Новый" }) !== null;

describe("switching between the layouts of the board", () => {
  it("starts on the board with the layouts in the header", async () => {
    setup();
    expect(await screen.findByRole("region", { name: "Новый" })).toBeInTheDocument();
    const tabs = within(await layouts()).getAllByRole("radio");
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Канбан", "Таблица", "Задачи"]);
    expect(screen.getByRole("radio", { name: "Канбан" })).toHaveAttribute("aria-checked", "true");
    expect(onTasks()).toBe(false);
  });

  it("offers no layout in Настройки", async () => {
    setup();
    await userEvent.click(await screen.findByRole("button", { name: "Настройки" }));
    expect(await screen.findByText("Поля карточки")).toBeInTheDocument();
    expect(screen.queryByText("Раскладка", { selector: "h3" })).toBeNull();
  });

  it("shows the tasks of the board once chosen, and only them", async () => {
    setup();
    await choose("Задачи");

    await waitFor(() => expect(onTasks()).toBe(true));
    expect(screen.getByRole("radio", { name: "Задачи" })).toHaveAttribute("aria-checked", "true");
    expect(onBoard()).toBe(false);
  });

  it("comes back to the board", async () => {
    setup();
    await choose("Задачи");
    await waitFor(() => expect(onTasks()).toBe(true));

    await choose("Канбан");
    expect(await screen.findByRole("region", { name: "Новый" })).toBeInTheDocument();
    expect(onTasks()).toBe(false);
  });

  it("returns to the layout the member left", async () => {
    const first = setup();
    await choose("Задачи");
    await waitFor(() => expect(onTasks()).toBe(true));
    first.unmount();

    setup();
    await waitFor(() => expect(onTasks()).toBe(true));
  });

  it("keeps one person's layout off another signing in on the same browser", async () => {
    server.use(mock.get("/api/auth/me", () => HttpResponse.json(sessionOf("user-1"))));
    const first = setup();
    await choose("Задачи");
    await waitFor(() => expect(onTasks()).toBe(true));
    first.unmount();

    server.use(mock.get("/api/auth/me", () => HttpResponse.json(sessionOf("user-2"))));
    setup();
    expect(await screen.findByRole("region", { name: "Новый" })).toBeInTheDocument();
    expect(onTasks()).toBe(false);
  });

  it("falls back to the board for a calendar remembered before it was removed", async () => {
    server.use(mock.get("/api/auth/me", () => HttpResponse.json(sessionOf("user-1"))));
    useModuleMemory.setState({ crmViews: { "user-1": "calendar" }, boards: {} });
    setup();

    expect(await screen.findByRole("region", { name: "Новый" })).toBeInTheDocument();
  });

  it("keeps the tasks layout when the board is switched", async () => {
    setup();
    await choose("Задачи");
    await waitFor(() => expect(onTasks()).toBe(true));

    await userEvent.click(screen.getByLabelText("Воронка"));
    await userEvent.click(screen.getByRole("option", { name: "Клиент" }));

    expect(onTasks()).toBe(true);
  });
});
