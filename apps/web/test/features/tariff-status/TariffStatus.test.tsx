import { http as mock, HttpResponse } from "msw";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { aSession, anEnterpriseTariff, renderWithProviders, server } from "@test/shared/index.js";
import { AppHeader } from "@/widgets/app-header/AppHeader.js";

const DAY = 24 * 60 * 60 * 1000;

function signedInWith(session: ReturnType<typeof aSession>) {
  server.use(mock.get("/api/auth/me", () => HttpResponse.json(session)));
}

const agency = anEnterpriseTariff({
  tariff: "AGENCY",
  limits: { projects: 15, clients: 15, users: 5, adAccounts: null },
  usage: { projects: 4, clients: 15, users: 2, adAccounts: 3 },
});

describe("the trial banner", () => {
  it("counts the days left while the trial runs", async () => {
    signedInWith(aSession({
      tariff: anEnterpriseTariff({
        tariff: "TRIAL", trialEndsAt: new Date(Date.now() + 6 * DAY - 60_000).toISOString(),
      }),
    }));
    renderWithProviders(<AppHeader />);

    const banner = await screen.findByText(/Дней до окончания/);
    expect(banner).toHaveTextContent("Пробный период. Дней до окончания: 6");
    expect(banner).toHaveAttribute("role", "status");
    expect(banner).toHaveAttribute("data-trial", "running");
  });

  it("says the organization is read-only once the trial has ended", async () => {
    signedInWith(aSession({
      role: "MANAGER",
      tariff: anEnterpriseTariff({
        tariff: "TRIAL", trialEndsAt: new Date(Date.now() - DAY).toISOString(), trialExpired: true,
      }),
    }));
    renderWithProviders(<AppHeader />);

    const notice = await screen.findByText(/Пробный период закончился/);
    expect(notice).toHaveAttribute("role", "alert");
    expect(notice).toHaveAttribute("data-trial", "ended");
  });

  it("stays hidden on a paid tariff", async () => {
    signedInWith(aSession({ tariff: agency }));
    renderWithProviders(<AppHeader />);

    await screen.findByRole("button", { name: "Тариф" });
    expect(screen.queryByText(/Пробный период/)).not.toBeInTheDocument();
  });
});

describe("the tariff view", () => {
  it("shows an administrator the tariff and the usage of each limit", async () => {
    signedInWith(aSession({ tariff: agency }));
    renderWithProviders(<AppHeader />);

    await userEvent.click(await screen.findByRole("button", { name: "Тариф" }));
    const dialog = await screen.findByRole("dialog", { name: /Тариф: Agency/ });
    const usage = within(dialog).getByRole("region", { name: "Использование" });

    const rows = within(usage).getAllByRole("term").map((term) => [term.textContent, term.nextElementSibling?.textContent]);
    expect(rows).toEqual([
      ["Проекты", "4 из 15"],
      ["Клиенты", "15 из 15"],
      ["Пользователи", "2 из 5"],
      ["Рекламные кабинеты", "3, без ограничений"],
    ]);
    expect(within(usage).getByText("15 из 15").closest("[data-resource]")).toHaveAttribute("data-full", "true");
    expect(within(usage).getByText("4 из 15").closest("[data-resource]")).toHaveAttribute("data-full", "false");
  });

  it("is not offered to a member who is not an administrator", async () => {
    signedInWith(aSession({ role: "MANAGER", tariff: agency }));
    renderWithProviders(<AppHeader />);

    await screen.findByRole("button", { name: "Уведомления" });
    expect(screen.queryByRole("button", { name: "Тариф" })).not.toBeInTheDocument();
  });
});
