import { http as mock, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { aProject, aTask, renderWithProviders, server } from "@test/shared/index.js";
import { TasksPage } from "@/pages/tasks/index.js";
import { useModuleMemory } from "@/shared/lib/index.js";
import { toIso } from "@/shared/ui/index.js";

function setup() {
  return renderWithProviders(<TasksPage />, { route: "/tasks" });
}

const sessionOf = (userId: string) => ({
  user: { id: userId, name: "Админ", email: "a@acme.com", image: null },
  organization: { id: "org-1", name: "AdPulse", slug: "adpulse" },
  role: "ADMIN",
  clientIds: [],
});

beforeEach(() => {
  useModuleMemory.setState({ taskViews: {} });
  server.use(
    mock.get("/api/projects", () => HttpResponse.json([aProject({ id: "project-1" })])),
    mock.get("/api/members", () => HttpResponse.json([])),
    mock.get("/api/tasks", () => HttpResponse.json([aTask({ dueDate: "2026-09-16" })])),
  );
});

const tab = (name: string) => screen.getByRole("radio", { name });

const onCalendar = () => screen.queryByRole("button", { name: "Следующая неделя" }) !== null;

describe("switching between the board and the calendar", () => {
  it("starts on the board", async () => {
    setup();
    expect(await screen.findByRole("radio", { name: "Канбан" })).toHaveAttribute("aria-checked", "true");
    expect(await screen.findByRole("heading", { name: "Идея", level: 2 })).toBeInTheDocument();
    expect(onCalendar()).toBe(false);
  });

  it("shows the calendar once it is chosen, and only the calendar", async () => {
    setup();
    await userEvent.click(await screen.findByRole("radio", { name: "Календарь" }));

    await waitFor(() => expect(onCalendar()).toBe(true));
    expect(tab("Календарь")).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByRole("heading", { name: "Идея", level: 2 })).not.toBeInTheDocument();
  });

  it("comes back to the board", async () => {
    setup();
    await userEvent.click(await screen.findByRole("radio", { name: "Календарь" }));
    await waitFor(() => expect(onCalendar()).toBe(true));

    await userEvent.click(tab("Канбан"));
    expect(await screen.findByRole("heading", { name: "Идея", level: 2 })).toBeInTheDocument();
    expect(onCalendar()).toBe(false);
  });

  it("switches from the keyboard", async () => {
    setup();
    (await screen.findByRole("radio", { name: "Канбан" })).focus();
    await userEvent.keyboard("{ArrowRight}");

    await waitFor(() => expect(onCalendar()).toBe(true));
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
    expect(await screen.findByRole("heading", { name: "Идея", level: 2 })).toBeInTheDocument();
    expect(onCalendar()).toBe(false);
  });
});

describe("the calls view", () => {
  const daily = { dueDate: "2020-01-06", dueTime: "10:00", repeatEvery: "DAILY" } as const;

  beforeEach(() => {
    server.use(mock.get("/api/tasks", () => HttpResponse.json([
      aTask({ id: "call", title: "Планёрка", ...daily, isCall: true }),
      aTask({ id: "routine", title: "Проверить ставки", ...daily }),
      aTask({ id: "ended", title: "Старый созвон", ...daily, isCall: true, column: "ARCHIVED" }),
    ])));
  });

  it("holds the calls alone, each on every day it recurs", async () => {
    setup();
    await userEvent.click(await screen.findByRole("radio", { name: "Созвоны" }));

    expect(await screen.findAllByText("Планёрка")).toHaveLength(7);
    expect(screen.getAllByText("Старый созвон")).toHaveLength(7);
    expect(tab("Созвоны")).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByText("Проверить ставки")).not.toBeInTheDocument();
  });

  it("keeps calls off the board", async () => {
    setup();

    expect(await screen.findByText("Проверить ставки")).toBeInTheDocument();
    expect(screen.queryByText("Планёрка")).not.toBeInTheDocument();
    expect(screen.queryByText("Старый созвон")).not.toBeInTheDocument();
  });

  it("keeps calls out of the calendar", async () => {
    server.use(mock.get("/api/tasks", () => HttpResponse.json([
      aTask({ id: "call", title: "Планёрка", dueDate: "2020-01-06", dueTime: "10:00", repeatEvery: "DAILY", isCall: true }),
      aTask({ id: "today", title: "Сверить бюджет", dueDate: toIso(new Date()), dueTime: "12:00" }),
    ])));
    setup();
    await userEvent.click(await screen.findByRole("radio", { name: "Календарь" }));

    expect(await screen.findByText("Сверить бюджет")).toBeInTheDocument();
    expect(screen.queryByText("Планёрка")).not.toBeInTheDocument();
  });
});
