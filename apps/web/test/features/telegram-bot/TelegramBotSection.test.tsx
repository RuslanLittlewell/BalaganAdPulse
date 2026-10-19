import { http, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, server } from "@test/shared/index.js";
import { TelegramBotSection, type TelegramStatus } from "@/features/telegram-bot/index.js";
import { ProfileSettingsDialog } from "@/features/profile-settings/index.js";

const LINK = "https://t.me/adpulse_bot?start=abc";

const status = (fields: Partial<TelegramStatus> = {}): TelegramStatus => ({
  available: true, linked: false, username: null, linkedAt: null, ...fields,
});

function serveStatus(initial: TelegramStatus) {
  let current = initial;
  const set = (next: TelegramStatus) => { current = next; };
  server.use(http.get("/api/telegram", () => HttpResponse.json(current)));
  return set;
}

const section = () => screen.findByRole("region", { name: "Telegram-бот" });

describe("the Telegram bot in the profile", () => {
  it("is not shown when the bot is not available to the member", async () => {
    let asked = false;
    server.use(http.get("/api/telegram", () => {
      asked = true;
      return HttpResponse.json(status({ available: false }));
    }));
    renderWithProviders(<ProfileSettingsDialog open onClose={() => {}} onAvatarSaved={() => {}} />);

    await waitFor(() => expect(asked).toBe(true));
    expect(screen.queryByRole("region", { name: "Telegram-бот" })).not.toBeInTheDocument();
  });

  it("is shown in the profile dialog when available", async () => {
    serveStatus(status());
    renderWithProviders(<ProfileSettingsDialog open onClose={() => {}} onAvatarSaved={() => {}} />);

    expect(await section()).toHaveTextContent("Создавайте задачи голосом");
  });

  it("gives a link to the bot and turns to linked once the member presses Start", async () => {
    const setStatus = serveStatus(status());
    server.use(http.post("/api/telegram/link", () =>
      HttpResponse.json({ url: LINK, expiresAt: "2026-10-19T12:15:00.000Z" }, { status: 201 })));
    renderWithProviders(<TelegramBotSection />);

    await userEvent.click(await screen.findByRole("button", { name: "Подключить" }));

    const open = await screen.findByRole("link", { name: "Открыть Telegram" });
    expect(open).toHaveAttribute("href", LINK);
    expect(open).toHaveAttribute("target", "_blank");
    expect(await section()).toHaveTextContent("Ссылка действует 15 минут");

    setStatus(status({ linked: true, username: "anna_t", linkedAt: "2026-10-19T12:01:00.000Z" }));

    await waitFor(() => expect(screen.getByRole("region", { name: "Telegram-бот" })).toHaveAttribute("data-linked", "true"), { timeout: 5000 });
    expect(await section()).toHaveTextContent("Подключён @anna_t");
    expect(screen.queryByRole("link", { name: "Открыть Telegram" })).not.toBeInTheDocument();
  });

  it("unlinks the member", async () => {
    const setStatus = serveStatus(status({ linked: true, username: "anna_t", linkedAt: "2026-10-19T12:01:00.000Z" }));
    let unlinked = false;
    server.use(http.delete("/api/telegram/link", () => {
      unlinked = true;
      setStatus(status());
      return new HttpResponse(null, { status: 204 });
    }));
    renderWithProviders(<TelegramBotSection />);

    await userEvent.click(await screen.findByRole("button", { name: "Отключить" }));

    await waitFor(() => expect(unlinked).toBe(true));
    expect(await screen.findByRole("button", { name: "Подключить" })).toBeInTheDocument();
  });

  it("says when a link could not be had", async () => {
    serveStatus(status());
    server.use(http.post("/api/telegram/link", () =>
      HttpResponse.json({ error: { message: "The Telegram bot is not available" } }, { status: 404 })));
    renderWithProviders(<TelegramBotSection />);

    await userEvent.click(await screen.findByRole("button", { name: "Подключить" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Не удалось получить ссылку на бота");
    expect(screen.queryByRole("link", { name: "Открыть Telegram" })).not.toBeInTheDocument();
  });
});
