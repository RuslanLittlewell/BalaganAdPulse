import { http as mock, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
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
  );
});

async function openOptions() {
  if (!screen.queryByRole("radiogroup", { name: "Раскладка" })) {
    await userEvent.click(await screen.findByRole("button", { name: "Настройки" }));
  }
  return screen.findByRole("radiogroup", { name: "Раскладка" });
}

async function choose(name: string) {
  await openOptions();
  await userEvent.click(screen.getByRole("radio", { name }));
  await userEvent.keyboard("{Escape}");
}

const onCalendar = () => screen.queryByRole("button", { name: "Следующая неделя" }) !== null;
const onBoard = () => screen.queryByRole("region", { name: "Новый" }) !== null;

describe("switching between the board and the calendar", () => {
  it("starts on the board", async () => {
    setup();
    expect(await screen.findByRole("region", { name: "Новый" })).toBeInTheDocument();
    await openOptions();
    expect(screen.getByRole("radio", { name: "Канбан" })).toHaveAttribute("aria-checked", "true");
    expect(onCalendar()).toBe(false);
  });

  it("shows the calendar once it is chosen, and only the calendar", async () => {
    setup();
    await choose("Календарь");

    await waitFor(() => expect(onCalendar()).toBe(true));
    await openOptions();
    expect(screen.getByRole("radio", { name: "Календарь" })).toHaveAttribute("aria-checked", "true");
    expect(onBoard()).toBe(false);
  });

  it("comes back to the board", async () => {
    setup();
    await choose("Календарь");
    await waitFor(() => expect(onCalendar()).toBe(true));

    await choose("Канбан");
    expect(await screen.findByRole("region", { name: "Новый" })).toBeInTheDocument();
    expect(onCalendar()).toBe(false);
  });

  it("returns to the view the member left", async () => {
    const first = setup();
    await choose("Календарь");
    await waitFor(() => expect(onCalendar()).toBe(true));
    first.unmount();

    setup();
    await waitFor(() => expect(onCalendar()).toBe(true));
  });

  it("keeps one person's view off another signing in on the same browser", async () => {
    server.use(mock.get("/api/auth/me", () => HttpResponse.json(sessionOf("user-1"))));
    const first = setup();
    await choose("Календарь");
    await waitFor(() => expect(onCalendar()).toBe(true));
    first.unmount();

    server.use(mock.get("/api/auth/me", () => HttpResponse.json(sessionOf("user-2"))));
    setup();
    expect(await screen.findByRole("region", { name: "Новый" })).toBeInTheDocument();
    expect(onCalendar()).toBe(false);
  });

  it("keeps the calendar shown when the board is switched", async () => {
    setup();
    await choose("Календарь");
    await waitFor(() => expect(onCalendar()).toBe(true));

    await userEvent.click(screen.getByLabelText("Воронка"));
    await userEvent.click(screen.getByRole("option", { name: "Клиент" }));

    expect(onCalendar()).toBe(true);
  });
});
