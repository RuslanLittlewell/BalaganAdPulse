import { http, HttpResponse } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, server } from "@test/shared/index.js";
import { navigation } from "@/shared/lib/index.js";
import { MetaIntegration } from "@/features/meta-integration/index.js";

const list = "/api/projects/p1/integrations";
const google = {
  id: "g1", provider: "GOOGLE", accountId: "2223334444", currency: "USD", timezone: "UTC", status: "SUCCESS",
  lastSuccessAt: "2026-09-08T06:00:00Z", lastError: null, nextDailyAt: "2026-09-09T06:00:00Z", leadsEnabled: false,
  leads: { status: "WAITING", lastSuccessAt: null, lastError: null },
};
const accounts = {
  renewing: false,
  accounts: [
    { accountId: "2223334444", name: "Магазин", currency: "USD", timezone: "UTC", loginCustomerId: "1112223333" },
    { accountId: "5556667777", name: "Блог", currency: "USD", timezone: "UTC", loginCustomerId: null },
  ],
};
const go = vi.spyOn(navigation, "go").mockImplementation(() => {});
afterEach(() => go.mockClear());

describe("adding Google from the provider window", () => {
  const choose = async () => {
    await userEvent.click(await screen.findByRole("button", { name: "Добавить интеграцию" }));
    await userEvent.click(await screen.findByRole("button", { name: "Google" }));
  };

  it("offers Google as a provider that can be chosen", async () => {
    server.use(http.get(list, () => HttpResponse.json([])));
    renderWithProviders(<MetaIntegration projectId="p1" />, { route: "/projects/p1" });

    await userEvent.click(await screen.findByRole("button", { name: "Добавить интеграцию" }));

    expect(await screen.findByRole("button", { name: "Google" })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Яндекс/ })).toBeDisabled();
  });

  it("starts the sign-in on this project and sends the browser to Google", async () => {
    let body: unknown;
    server.use(
      http.get(list, () => HttpResponse.json([])),
      http.post(`${list}/google/authorize`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ url: "https://accounts.google.com/o/oauth2/v2/auth?state=s1" });
      }),
    );
    renderWithProviders(<MetaIntegration projectId="p1" />, { route: "/projects/p1" });

    await choose();

    await waitFor(() => expect(go).toHaveBeenCalledWith("https://accounts.google.com/o/oauth2/v2/auth?state=s1"));
    expect(body).toEqual({});
  });

  it("says in Russian that Google is not set up on the server", async () => {
    server.use(
      http.get(list, () => HttpResponse.json([])),
      http.post(`${list}/google/authorize`, () =>
        HttpResponse.json({ error: { message: "Google integration: CONFIGURATION", details: [{ code: "CONFIGURATION" }] } }, { status: 400 })),
    );
    renderWithProviders(<MetaIntegration projectId="p1" />, { route: "/projects/p1" });

    await choose();

    expect(await screen.findByText("Интеграция с Google Ads не настроена на сервере. Обратитесь к администратору.")).toBeInTheDocument();
    expect(go).not.toHaveBeenCalled();
  });
});

describe("coming back from Google", () => {
  it("says the sign-in failed when Google or the server turned it down", async () => {
    server.use(http.get(list, () => HttpResponse.json([])));
    renderWithProviders(<MetaIntegration projectId="p1" />, { route: "/projects/p1?google=failed" });

    expect(await screen.findByText("Не удалось войти через Google. Попробуйте ещё раз.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Закрыть" }));
    expect(screen.queryByText("Не удалось войти через Google. Попробуйте ещё раз.")).not.toBeInTheDocument();
  });

  it("lists the accounts the sign-in reaches and connects the one chosen", async () => {
    let sent: unknown;
    let connected = false;
    server.use(
      http.get(list, () => HttpResponse.json(connected ? [google] : [])),
      http.get(`${list}/google/accounts`, ({ request }) => {
        expect(new URL(request.url).searchParams.get("authorization")).toBe("auth-1");
        return HttpResponse.json(accounts);
      }),
      http.post(`${list}/google`, async ({ request }) => {
        sent = await request.json();
        connected = true;
        return HttpResponse.json(google, { status: 201 });
      }),
    );
    renderWithProviders(<MetaIntegration projectId="p1" />, { route: "/projects/p1?google=auth-1" });

    const dialog = await screen.findByRole("dialog", { name: "Выберите аккаунт Google Ads" });
    const connect = within(dialog).getByRole("button", { name: "Подключить" });
    expect(connect).toBeDisabled();
    await userEvent.click(await within(dialog).findByRole("combobox", { name: "Аккаунт" }));
    await userEvent.click(await screen.findByRole("option", { name: /Магазин/ }));
    await userEvent.click(connect);

    await waitFor(() => expect(sent).toEqual({ authorization: "auth-1", accountId: "2223334444", loginCustomerId: "1112223333" }));
    expect(await screen.findByRole("region", { name: "Google Ads" })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Выберите аккаунт Google Ads" })).not.toBeInTheDocument());
  });

  it("says so when the sign-in reaches no account to connect", async () => {
    server.use(
      http.get(list, () => HttpResponse.json([])),
      http.get(`${list}/google/accounts`, () => HttpResponse.json({ renewing: false, accounts: [] })),
    );
    renderWithProviders(<MetaIntegration projectId="p1" />, { route: "/projects/p1?google=auth-1" });

    expect(await screen.findByText(/Нет доступных аккаунтов/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Подключить" })).toBeDisabled();
  });

  it("shows why an account cannot be connected and keeps the choice open", async () => {
    server.use(
      http.get(list, () => HttpResponse.json([])),
      http.get(`${list}/google/accounts`, () => HttpResponse.json(accounts)),
      http.post(`${list}/google`, () =>
        HttpResponse.json({ error: { message: "x", details: [{ code: "CURRENCY" }] } }, { status: 400 })),
    );
    renderWithProviders(<MetaIntegration projectId="p1" />, { route: "/projects/p1?google=auth-1" });

    await userEvent.click(await screen.findByRole("combobox", { name: "Аккаунт" }));
    await userEvent.click(await screen.findByRole("option", { name: /Блог/ }));
    await userEvent.click(screen.getByRole("button", { name: "Подключить" }));

    expect(await screen.findByText(/Валюта рекламного аккаунта отличается/)).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Выберите аккаунт Google Ads" })).toBeInTheDocument();
  });

  it("finishes renewing a sign-in without asking for an account", async () => {
    let sent: unknown;
    server.use(
      http.get(list, () => HttpResponse.json([google])),
      http.get(`${list}/google/accounts`, () => HttpResponse.json({ renewing: true, accounts: [] })),
      http.post(`${list}/google`, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json(google);
      }),
    );
    renderWithProviders(<MetaIntegration projectId="p1" />, { route: "/projects/p1?google=auth-2" });

    await waitFor(() => expect(sent).toEqual({ authorization: "auth-2" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});

describe("a Google connection's panel", () => {
  it("shows the last update and refreshes by hand", async () => {
    let refreshes = 0;
    server.use(
      http.get(list, () => HttpResponse.json([google])),
      http.post(`${list}/g1/sync`, () => { refreshes += 1; return HttpResponse.json({ ...google, status: "QUEUED" }); }),
    );
    renderWithProviders(<MetaIntegration projectId="p1" />, { route: "/projects/p1" });

    const panel = await screen.findByRole("region", { name: "Google Ads" });
    expect(within(panel).getByText(/Обновление:/)).toBeInTheDocument();
    await userEvent.click(within(panel).getByRole("button", { name: "Обновить" }));

    await waitFor(() => expect(refreshes).toBe(1));
    await waitFor(() => expect(within(panel).getByRole("button", { name: "Обновить" })).toHaveAttribute("aria-busy", "true"));
  });

  it("asks to sign in again when Google took the access back, and signs in on the same connection", async () => {
    let body: unknown;
    server.use(
      http.get(list, () => HttpResponse.json([{ ...google, status: "AUTH_REQUIRED", lastError: "TOKEN" }])),
      http.post(`${list}/google/authorize`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ url: "https://accounts.google.com/o/oauth2/v2/auth?state=s2" });
      }),
    );
    renderWithProviders(<MetaIntegration projectId="p1" />, { route: "/projects/p1" });

    expect(await screen.findByText("Доступ Google отозван или истёк. Войдите через Google заново.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Google Ads API" }));
    expect(screen.queryByLabelText(/токен/i)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Войти заново" }));

    await waitFor(() => expect(go).toHaveBeenCalledWith("https://accounts.google.com/o/oauth2/v2/auth?state=s2"));
    expect(body).toEqual({ integrationId: "g1" });
  });

  it("disconnects, leaving the other connections alone", async () => {
    let removed = false;
    server.use(
      http.get(list, () => HttpResponse.json([google])),
      http.delete(`${list}/g1`, () => { removed = true; return new HttpResponse(null, { status: 204 }); }),
    );
    renderWithProviders(<MetaIntegration projectId="p1" />, { route: "/projects/p1" });

    await userEvent.click(await screen.findByRole("button", { name: "Google Ads API" }));
    await userEvent.click(screen.getByRole("button", { name: "Отключить" }));

    await waitFor(() => expect(removed).toBe(true));
    await waitFor(() => expect(screen.queryByRole("region", { name: "Google Ads" })).not.toBeInTheDocument());
  });

  it("is drawn beside a Meta panel, each with its own title", async () => {
    server.use(http.get(list, () => HttpResponse.json([
      { ...google, provider: "META", id: "m1", accountId: "123" },
      google,
    ])));
    renderWithProviders(<MetaIntegration projectId="p1" />, { route: "/projects/p1" });

    expect(await screen.findByRole("region", { name: "Google Ads" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Meta · Facebook Ads" })).toBeInTheDocument();
  });
});
