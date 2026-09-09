import { http as mock, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import { renderWithProviders, server } from "@test/shared/index.js";
import { PeriodControl, usePeriod } from "@/features/period/index.js";
import { useAgencySummary } from "@/entities/campaign/index.js";

function Screen() {
  const { range } = usePeriod();
  const location = useLocation();
  return <><output>{`${range.from}..${range.to}`}</output><span data-testid="search">{location.search}</span></>;
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date("2026-08-17T12:00:00"));
});
afterEach(() => { vi.useRealTimers(); });

describe("PeriodControl", () => {
  it("starts on the last thirty days with two date inputs", () => {
    renderWithProviders(<><PeriodControl /><Screen /></>);
    expect(screen.getByLabelText("От")).toHaveValue("2026-07-19");
    expect(screen.getByLabelText("До")).toHaveValue("2026-08-17");
    expect(screen.getByRole("status").textContent).toBe("2026-07-19..2026-08-17");
    expect(screen.queryByRole("button", { name: "30 дней" })).not.toBeInTheDocument();
  });

  it("restores a valid range from the address", () => {
    renderWithProviders(<><PeriodControl /><Screen /></>, { route: "/?from=2026-05-03&to=2026-06-04" });
    expect(screen.getByLabelText("От")).toHaveValue("2026-05-03");
    expect(screen.getByLabelText("До")).toHaveValue("2026-06-04");
    expect(screen.getByRole("status").textContent).toBe("2026-05-03..2026-06-04");
  });

  it.each([
    "/?from=2026-02-30&to=2026-03-02",
    "/?from=2026-08-18&to=2026-08-17",
    "/?from=2026-08-01",
    "/?period=7d",
  ])("falls back for invalid address range %s", (route) => {
    renderWithProviders(<Screen />, { route });
    expect(screen.getByRole("status").textContent).toBe("2026-07-19..2026-08-17");
  });

  it("accepts a manually entered valid range and stores it in the address", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithProviders(<><PeriodControl /><Screen /></>);
    const from = screen.getByLabelText("От");
    await user.clear(from);
    await user.type(from, "2026-06-01");
    const to = screen.getByLabelText("До");
    await user.clear(to);
    await user.type(to, "2026-06-30");
    expect(screen.getByRole("status").textContent).toBe("2026-06-01..2026-06-30");
    expect(screen.getByTestId("search")).toHaveTextContent("from=2026-06-01");
    expect(screen.getByTestId("search")).toHaveTextContent("to=2026-06-30");
  });

  it("keeps the last valid query range and explains a reversed draft", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const seen: URL[] = [];
    server.use(mock.get("/api/summary", ({ request }) => { seen.push(new URL(request.url)); return HttpResponse.json({}); }));
    renderWithProviders(<><PeriodControl /><Screen /><Fetching /></>);
    await waitFor(() => expect(seen).toHaveLength(1));
    const from = screen.getByLabelText("От");
    await user.clear(from);
    await user.type(from, "2026-08-18");
    expect(screen.getByText("Дата «От» не может быть позже даты «До»")).toBeInTheDocument();
    expect(screen.getByRole("status").textContent).toBe("2026-07-19..2026-08-17");
    expect(seen).toHaveLength(1);
  });

  it("opens both Russian shadcn calendars and applies a calendar selection", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithProviders(<><PeriodControl /><Screen /></>);
    await user.click(screen.getByRole("button", { name: "Открыть календарь даты начала" }));
    expect(screen.getByRole("dialog", { name: "Выберите дату начала" })).toHaveTextContent("июль 2026");
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Открыть календарь даты окончания" }));
    expect(screen.getByRole("dialog", { name: "Выберите дату окончания" })).toHaveTextContent("август 2026");
    await user.click(screen.getByRole("button", { name: "10 августа 2026 г." }));
    expect(screen.getByRole("status").textContent).toBe("2026-07-19..2026-08-10");
  });

  it("fills both dates from a shortcut and stores them in the address", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithProviders(<><PeriodControl /><Screen /></>);
    await user.click(screen.getByRole("button", { name: "7 дней" }));
    expect(screen.getByLabelText("От")).toHaveValue("2026-08-11");
    expect(screen.getByLabelText("До")).toHaveValue("2026-08-17");
    expect(screen.getByRole("status").textContent).toBe("2026-08-11..2026-08-17");
    expect(screen.getByTestId("search")).toHaveTextContent("from=2026-08-11");
    expect(screen.getByTestId("search")).toHaveTextContent("to=2026-08-17");
  });

  it("offers this month and the previous month as shortcuts", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithProviders(<><PeriodControl /><Screen /></>);
    await user.click(screen.getByRole("button", { name: "Этот месяц" }));
    expect(screen.getByRole("status").textContent).toBe("2026-08-01..2026-08-17");
    await user.click(screen.getByRole("button", { name: "Прошлый месяц" }));
    expect(screen.getByRole("status").textContent).toBe("2026-07-01..2026-07-31");
  });

  it("presses only the shortcut matching the current range", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithProviders(<><PeriodControl /><Screen /></>);
    const shortcut = (name: string) => screen.getByRole("button", { name });
    expect(shortcut("7 дней")).toHaveAttribute("aria-pressed", "false");
    await user.click(shortcut("7 дней"));
    expect(shortcut("7 дней")).toHaveAttribute("aria-pressed", "true");
    expect(shortcut("Этот месяц")).toHaveAttribute("aria-pressed", "false");
    expect(shortcut("Прошлый месяц")).toHaveAttribute("aria-pressed", "false");
  });

  it("asks the server for the exact selected inclusive range", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const seen: URL[] = [];
    server.use(mock.get("/api/summary", ({ request }) => { seen.push(new URL(request.url)); return HttpResponse.json({}); }));
    renderWithProviders(<><PeriodControl /><Fetching /></>);
    await waitFor(() => expect(seen).toHaveLength(1));
    const from = screen.getByLabelText("От");
    await user.clear(from);
    await user.type(from, "2026-06-01");
    const to = screen.getByLabelText("До");
    await user.clear(to);
    await user.type(to, "2026-06-30");
    await waitFor(() => expect(seen.at(-1)?.searchParams.get("from")).toBe("2026-06-01"));
    expect(seen.at(-1)?.searchParams.get("to")).toBe("2026-06-30");
  });
});

function Fetching() {
  const { range } = usePeriod();
  useAgencySummary(range);
  return null;
}
