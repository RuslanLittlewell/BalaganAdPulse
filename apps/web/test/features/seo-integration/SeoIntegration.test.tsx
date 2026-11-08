import { http, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, server } from "@test/shared/index.js";
import { navigation } from "@/shared/lib/index.js";
import { MetaIntegration } from "@/features/meta-integration/index.js";

const seo = "/api/projects/p1/seo";
const site = {
  id: "s1", siteUrl: "sc-domain:site.ru", label: "site.ru", status: "SUCCESS", lastSuccessAt: "2026-11-07T06:00:00Z",
  lastError: null, checkStatus: "SUCCESS", lastCheckAt: "2026-11-05T06:00:00Z", checkError: null, analytics: null,
};
const go = vi.spyOn(navigation, "go").mockImplementation(() => {});
afterEach(() => go.mockClear());

describe("adding Search Console from the provider window", () => {
  it("offers Search Console as a provider that can be chosen", async () => {
    renderWithProviders(<MetaIntegration projectId="p1" />, { route: "/projects/p1" });

    await userEvent.click(await screen.findByRole("button", { name: "Добавить интеграцию" }));

    expect(await screen.findByRole("button", { name: "Search Console" })).toBeEnabled();
  });

  it("starts the Search Console sign-in and sends the browser to Google", async () => {
    let body: unknown;
    server.use(http.post(`${seo}/authorize`, async ({ request }) => {
      body = await request.json();
      return HttpResponse.json({ url: "https://accounts.google.com/o/oauth2/v2/auth?state=c1" });
    }));
    renderWithProviders(<MetaIntegration projectId="p1" />, { route: "/projects/p1" });

    await userEvent.click(await screen.findByRole("button", { name: "Добавить интеграцию" }));
    await userEvent.click(await screen.findByRole("button", { name: "Search Console" }));

    await waitFor(() => expect(go).toHaveBeenCalledWith("https://accounts.google.com/o/oauth2/v2/auth?state=c1"));
    expect(body).toEqual({});
  });

  it("says in Russian that Search Console is not set up on the server", async () => {
    server.use(http.post(`${seo}/authorize`, () =>
      HttpResponse.json({ error: { message: "SEO integration: CONFIGURATION", details: [{ code: "CONFIGURATION" }] } }, { status: 400 })));
    renderWithProviders(<MetaIntegration projectId="p1" />, { route: "/projects/p1" });

    await userEvent.click(await screen.findByRole("button", { name: "Добавить интеграцию" }));
    await userEvent.click(await screen.findByRole("button", { name: "Search Console" }));

    expect(await screen.findByText("Интеграция с Search Console не настроена на сервере. Обратитесь к администратору.")).toBeInTheDocument();
    expect(go).not.toHaveBeenCalled();
  });
});

describe("coming back from Google with a Search Console sign-in", () => {
  it("lets the member choose one of the sites the sign-in reaches", async () => {
    let connected: unknown;
    server.use(
      http.get(`${seo}/authorizations/a1/sites`, () => HttpResponse.json({ renewing: false, sites: [
        { siteUrl: "sc-domain:site.ru", label: "site.ru", permissionLevel: "siteOwner" },
        { siteUrl: "https://shop.ru/", label: "shop.ru", permissionLevel: "siteFullUser" },
      ] })),
      http.post(`${seo}/sites`, async ({ request }) => {
        connected = await request.json();
        return HttpResponse.json(site, { status: 201 });
      }),
    );
    renderWithProviders(<MetaIntegration projectId="p1" />, { route: "/projects/p1?searchConsole=a1" });

    await userEvent.click(await screen.findByRole("combobox", { name: "Сайт" }));
    await userEvent.click(await screen.findByRole("option", { name: "shop.ru" }));
    await userEvent.click(screen.getByRole("button", { name: "Подключить" }));

    await waitFor(() => expect(connected).toEqual({ authorization: "a1", siteUrl: "https://shop.ru/" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Выберите сайт из Search Console" })).toBeNull());
  });

  it("lets the member choose a Google Analytics property together with the site", async () => {
    let connected: unknown;
    server.use(
      http.get(`${seo}/authorizations/a5/sites`, () => HttpResponse.json({
        renewing: false,
        sites: [{ siteUrl: "sc-domain:site.ru", label: "site.ru", permissionLevel: "siteOwner" }],
        properties: [{ propertyId: "111", name: "Acme / site.ru" }, { propertyId: "222", name: "Acme / shop.ru" }],
      })),
      http.post(`${seo}/sites`, async ({ request }) => {
        connected = await request.json();
        return HttpResponse.json(site, { status: 201 });
      }),
    );
    renderWithProviders(<MetaIntegration projectId="p1" />, { route: "/projects/p1?searchConsole=a5" });

    await userEvent.click(await screen.findByRole("combobox", { name: "Сайт" }));
    await userEvent.click(await screen.findByRole("option", { name: "site.ru" }));
    await userEvent.click(screen.getByRole("combobox", { name: "Ресурс Google Analytics" }));
    await userEvent.click(await screen.findByRole("option", { name: "Acme / site.ru" }));
    await userEvent.click(screen.getByRole("button", { name: "Подключить" }));

    await waitFor(() => expect(connected).toEqual({ authorization: "a5", siteUrl: "sc-domain:site.ru", propertyId: "111" }));
  });

  it("connects the site without Analytics when the member does not pick a property", async () => {
    let connected: unknown;
    server.use(
      http.get(`${seo}/authorizations/a6/sites`, () => HttpResponse.json({
        renewing: false,
        sites: [{ siteUrl: "sc-domain:site.ru", label: "site.ru", permissionLevel: "siteOwner" }],
        properties: [{ propertyId: "111", name: "Acme / site.ru" }],
      })),
      http.post(`${seo}/sites`, async ({ request }) => {
        connected = await request.json();
        return HttpResponse.json(site, { status: 201 });
      }),
    );
    renderWithProviders(<MetaIntegration projectId="p1" />, { route: "/projects/p1?searchConsole=a6" });

    await userEvent.click(await screen.findByRole("combobox", { name: "Сайт" }));
    await userEvent.click(await screen.findByRole("option", { name: "site.ru" }));
    await userEvent.click(screen.getByRole("button", { name: "Подключить" }));

    await waitFor(() => expect(connected).toEqual({ authorization: "a6", siteUrl: "sc-domain:site.ru" }));
  });

  it("offers no property choice when the sign-in reaches no Analytics property", async () => {
    server.use(http.get(`${seo}/authorizations/a7/sites`, () => HttpResponse.json({
      renewing: false,
      sites: [{ siteUrl: "sc-domain:site.ru", label: "site.ru", permissionLevel: "siteOwner" }],
      properties: [],
    })));
    renderWithProviders(<MetaIntegration projectId="p1" />, { route: "/projects/p1?searchConsole=a7" });

    await screen.findByRole("combobox", { name: "Сайт" });
    expect(screen.queryByRole("combobox", { name: "Ресурс Google Analytics" })).toBeNull();
  });

  it("renews the site it was started for without asking", async () => {
    let connected: unknown;
    server.use(
      http.get(`${seo}/authorizations/a2/sites`, () => HttpResponse.json({ renewing: true, sites: [] })),
      http.post(`${seo}/sites`, async ({ request }) => {
        connected = await request.json();
        return HttpResponse.json(site);
      }),
    );
    renderWithProviders(<MetaIntegration projectId="p1" />, { route: "/projects/p1?searchConsole=a2" });

    await waitFor(() => expect(connected).toEqual({ authorization: "a2" }));
  });

  it("says the sign-in failed", async () => {
    renderWithProviders(<MetaIntegration projectId="p1" />, { route: "/projects/p1?searchConsole=failed" });
    expect(await screen.findByText("Не удалось войти через Google. Попробуйте ещё раз.")).toBeInTheDocument();
  });

  it("explains an account without sites", async () => {
    server.use(http.get(`${seo}/authorizations/a3/sites`, () => HttpResponse.json({ renewing: false, sites: [] })));
    renderWithProviders(<MetaIntegration projectId="p1" />, { route: "/projects/p1?searchConsole=a3" });
    expect(await screen.findByText(/Нет доступных сайтов/)).toBeInTheDocument();
  });
});

describe("a connected site's panel", () => {
  it("is titled Google Search Console and names the site and its times", async () => {
    server.use(http.get(`${seo}/sites`, () => HttpResponse.json([site])));
    renderWithProviders(<MetaIntegration projectId="p1" />, { route: "/projects/p1" });

    const panel = await screen.findByRole("region", { name: "Google Search Console" });
    expect(panel).toHaveTextContent("site.ru");
    expect(panel).toHaveTextContent("Страницы проверены");
  });

  it("refreshes the site's import", async () => {
    let synced = false;
    server.use(
      http.get(`${seo}/sites`, () => HttpResponse.json([site])),
      http.post(`${seo}/sites/s1/sync`, () => {
        synced = true;
        return HttpResponse.json({ ...site, status: "QUEUED" }, { status: 202 });
      }),
    );
    renderWithProviders(<MetaIntegration projectId="p1" />, { route: "/projects/p1" });

    await userEvent.click(await screen.findByRole("button", { name: "Обновить" }));

    await waitFor(() => expect(synced).toBe(true));
  });

  it("asks for a new sign-in when Google revoked access", async () => {
    server.use(http.get(`${seo}/sites`, () => HttpResponse.json([{ ...site, status: "AUTH_REQUIRED", lastError: "TOKEN" }])));
    renderWithProviders(<MetaIntegration projectId="p1" />, { route: "/projects/p1" });
    expect(await screen.findByText("Доступ Google отозван или истёк. Войдите через Google заново.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Обновить" })).toBeDisabled();
  });

  it("asks before disconnecting, then removes the panel", async () => {
    let deleted = false;
    server.use(
      http.get(`${seo}/sites`, () => HttpResponse.json(deleted ? [] : [site])),
      http.delete(`${seo}/sites/s1`, () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderWithProviders(<MetaIntegration projectId="p1" />, { route: "/projects/p1" });

    await userEvent.click(await screen.findByRole("button", { name: "API" }));
    await userEvent.click(await screen.findByRole("button", { name: "Отключить" }));
    expect(await screen.findByText("Отключить сайт?")).toBeInTheDocument();
    expect(deleted).toBe(false);
    await userEvent.click(screen.getAllByRole("button", { name: "Отключить" }).at(-1)!);

    await waitFor(() => expect(deleted).toBe(true));
    await waitFor(() => expect(screen.queryByRole("region", { name: "Google Search Console" })).toBeNull());
  });
});

describe("linking Google Analytics to a site", () => {
  it("starts the Analytics sign-in for the site from its settings", async () => {
    server.use(
      http.get(`${seo}/sites`, () => HttpResponse.json([site])),
      http.post(`${seo}/sites/s1/analytics/authorize`, () => HttpResponse.json({ url: "https://accounts.google.com/o/oauth2/v2/auth?state=g1" })),
    );
    renderWithProviders(<MetaIntegration projectId="p1" />, { route: "/projects/p1" });

    await userEvent.click(await screen.findByRole("button", { name: "API" }));
    await userEvent.click(await screen.findByRole("button", { name: "Подключить Google Analytics" }));

    await waitFor(() => expect(go).toHaveBeenCalledWith("https://accounts.google.com/o/oauth2/v2/auth?state=g1"));
  });

  it("lets the member choose a property after coming back from Google", async () => {
    let linkedWith: unknown;
    server.use(
      http.get(`${seo}/analytics-authorizations/g1/properties`, () => HttpResponse.json({ siteId: "s1", properties: [
        { propertyId: "111", name: "Acme / site.ru" },
        { propertyId: "222", name: "Acme / shop.ru" },
      ] })),
      http.put(`${seo}/sites/s1/analytics`, async ({ request }) => {
        linkedWith = await request.json();
        return HttpResponse.json(site);
      }),
    );
    renderWithProviders(<MetaIntegration projectId="p1" />, { route: "/projects/p1?analytics=g1" });

    await userEvent.click(await screen.findByRole("combobox", { name: "Ресурс Google Analytics" }));
    await userEvent.click(await screen.findByRole("option", { name: "Acme / shop.ru" }));
    await userEvent.click(screen.getByRole("button", { name: "Подключить" }));

    await waitFor(() => expect(linkedWith).toEqual({ authorization: "g1", propertyId: "222" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Выберите ресурс Google Analytics 4" })).toBeNull());
  });

  it("explains an account without properties", async () => {
    server.use(http.get(`${seo}/analytics-authorizations/g2/properties`, () => HttpResponse.json({ siteId: "s1", properties: [] })));
    renderWithProviders(<MetaIntegration projectId="p1" />, { route: "/projects/p1?analytics=g2" });
    expect(await screen.findByText(/нет ресурсов Google Analytics 4/)).toBeInTheDocument();
  });

  it("says the Analytics sign-in failed", async () => {
    renderWithProviders(<MetaIntegration projectId="p1" />, { route: "/projects/p1?analytics=failed" });
    expect(await screen.findByText("Не удалось войти через Google. Попробуйте ещё раз.")).toBeInTheDocument();
  });

  it("unlinks the property after a confirmation", async () => {
    let unlinked = false;
    server.use(
      http.get(`${seo}/sites`, () => HttpResponse.json([{ ...site, analytics: { propertyId: "111", name: "Acme / site.ru", status: "SUCCESS", lastSuccessAt: null, lastError: null } }])),
      http.delete(`${seo}/sites/s1/analytics`, () => {
        unlinked = true;
        return HttpResponse.json(site);
      }),
    );
    renderWithProviders(<MetaIntegration projectId="p1" />, { route: "/projects/p1" });

    await userEvent.click(await screen.findByRole("button", { name: "API" }));
    expect(await screen.findByText("Acme / site.ru")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Отключить Google Analytics" }));
    await userEvent.click(await screen.findByRole("button", { name: "Отключить Google Analytics" }));

    await waitFor(() => expect(unlinked).toBe(true));
  });
});
