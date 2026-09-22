import { http as mock, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { aLead, renderWithProviders, server } from "@test/shared/index.js";
import { CrmPage } from "@/pages/crm/index.js";
import { useModuleMemory } from "@/shared/lib/index.js";

const capabilities = { create: true, update: true, delete: true };
const boards = [
  { key: "agency", label: "Agency", capabilities },
  { key: "client-1", label: "Клиент", capabilities },
];

function setup() {
  return renderWithProviders(<CrmPage />, { route: "/crm" });
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
      HttpResponse.json(params.board === "agency" ? [aLead({ id: "lead-1", name: "Анна" })] : [])),
  );
});

const tab = (name: string) => screen.getByRole("radio", { name });

const onCalendar = () => screen.queryByRole("button", { name: "Следующая неделя" }) !== null;
const onBoard = () => screen.queryByRole("region", { name: "Новый" }) !== null;

describe("switching between the board and the calendar", () => {
  it("starts on the board", async () => {
    setup();
    expect(await screen.findByRole("radio", { name: "Канбан" })).toHaveAttribute("aria-checked", "true");
    expect(await screen.findByRole("region", { name: "Новый" })).toBeInTheDocument();
    expect(onCalendar()).toBe(false);
  });

  it("shows the calendar once it is chosen, and only the calendar", async () => {
    setup();
    await userEvent.click(await screen.findByRole("radio", { name: "Календарь" }));

    await waitFor(() => expect(onCalendar()).toBe(true));
    expect(tab("Календарь")).toHaveAttribute("aria-checked", "true");
    expect(onBoard()).toBe(false);
  });

  it("comes back to the board", async () => {
    setup();
    await userEvent.click(await screen.findByRole("radio", { name: "Календарь" }));
    await waitFor(() => expect(onCalendar()).toBe(true));

    await userEvent.click(tab("Канбан"));
    expect(await screen.findByRole("region", { name: "Новый" })).toBeInTheDocument();
    expect(onCalendar()).toBe(false);
  });

  it("returns to the view the member left", async () => {
    const first = setup();
    await userEvent.click(await screen.findByRole("radio", { name: "Календарь" }));
    await waitFor(() => expect(onCalendar()).toBe(true));
    first.unmount();

    setup();
    await waitFor(() => expect(onCalendar()).toBe(true));
  });

  it("keeps one person's view off another signing in on the same browser", async () => {
    server.use(mock.get("/api/auth/me", () => HttpResponse.json(sessionOf("user-1"))));
    const first = setup();
    await userEvent.click(await screen.findByRole("radio", { name: "Календарь" }));
    await waitFor(() => expect(onCalendar()).toBe(true));
    first.unmount();

    server.use(mock.get("/api/auth/me", () => HttpResponse.json(sessionOf("user-2"))));
    setup();
    expect(await screen.findByRole("region", { name: "Новый" })).toBeInTheDocument();
    expect(onCalendar()).toBe(false);
  });

  it("keeps the calendar shown when the board is switched", async () => {
    setup();
    await userEvent.click(await screen.findByRole("radio", { name: "Календарь" }));
    await waitFor(() => expect(onCalendar()).toBe(true));

    await userEvent.click(screen.getByLabelText("Воронка"));
    await userEvent.click(screen.getByRole("option", { name: "Клиент" }));

    expect(onCalendar()).toBe(true);
  });
});
