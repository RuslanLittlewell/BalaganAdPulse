import { http as mock, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, server } from "@test/shared/index.js";
import { PeriodControl, usePeriod } from "@/features/period/index.js";
import { useAgencySummary } from "@/entities/campaign/index.js";

/** A stand-in for any screen: it reads the range the same way the real ones do
 * and fetches with it, so the assertion is about what the server was asked. */
function Screen() {
  const { range } = usePeriod();
  return <output>{`${range.from}..${range.to}`}</output>;
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date("2026-08-17T12:00:00"));
});
afterEach(() => { vi.useRealTimers(); });

describe("PeriodControl", () => {
  it("starts on the last thirty days", () => {
    renderWithProviders(<><PeriodControl /><Screen /></>);

    expect(screen.getByRole("button", { name: "30 дней" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("status").textContent).toBe("2026-07-19..2026-08-17");
  });

  it("changes the range every screen reads", async () => {
    const user = userEvent.setup();
    renderWithProviders(<><PeriodControl /><Screen /></>);

    await user.click(screen.getByRole("button", { name: "7 дней" }));

    expect(screen.getByRole("status").textContent).toBe("2026-08-11..2026-08-17");
    expect(screen.getByRole("button", { name: "7 дней" })).toHaveAttribute("aria-pressed", "true");
  });

  // The range is part of what a link means: a colleague sent last month's
  // figures must open last month's figures.
  it("reads the period out of the address", () => {
    renderWithProviders(<Screen />, { route: "/?period=prevMonth" });

    expect(screen.getByRole("status").textContent).toBe("2026-07-01..2026-07-31");
  });

  it("falls back to the default for an address naming nothing it knows", () => {
    renderWithProviders(<Screen />, { route: "/?period=eternity" });

    expect(screen.getByRole("status").textContent).toBe("2026-07-19..2026-08-17");
  });

  it("asks the server for the range it shows", async () => {
    const user = userEvent.setup();
    const seen: URL[] = [];
    server.use(mock.get("/api/summary", ({ request }) => {
      seen.push(new URL(request.url));
      return HttpResponse.json({});
    }));

    renderWithProviders(<><PeriodControl /><Fetching /></>);
    await waitFor(() => expect(seen).toHaveLength(1));

    await user.click(screen.getByRole("button", { name: "Этот месяц" }));

    await waitFor(() => expect(seen).toHaveLength(2));
    expect(seen[1].searchParams.get("from")).toBe("2026-08-01");
  });
});


function Fetching() {
  const { range } = usePeriod();
  useAgencySummary(range);
  return null;
}
