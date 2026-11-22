import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse, type JsonBodyType } from "msw";
import { aSession, renderWithProviders, server } from "@test/shared/index.js";
import { TwoFactorSettings, TwoFactorSetupScreen, PlatformTwoFactorReset } from "@/features/two-factor/index.js";
import { EmployeeDirectory } from "@/widgets/contact-book/EmployeeDirectory.js";

const CODES = Array.from({ length: 10 }, (_, index) => `code${index}-abcde`);

function serve(initial: { enabled: boolean; required?: boolean }) {
  let status: Record<string, JsonBodyType> = { enabled: initial.enabled, required: initial.required ?? false, backupCodesLeft: initial.enabled ? 10 : 0 };
  const sent: Array<{ method: string; path: string; body?: unknown }> = [];
  server.use(
    http.get("/api/two-factor", () => HttpResponse.json(status)),
    http.post("/api/two-factor/setup", () => HttpResponse.json({ key: "JBSWY3DPEHPK3PXP", uri: "otpauth://totp/x", qrSvg: "<svg xmlns='http://www.w3.org/2000/svg'></svg>" })),
    http.post("/api/two-factor/confirm", async ({ request }) => {
      const body = await request.json();
      sent.push({ method: "POST", path: "confirm", body });
      if ((body as { code: string }).code === "000000") {
        return HttpResponse.json({ error: { message: "bad", details: [{ code: "INVALID_CODE" }] } }, { status: 400 });
      }
      status = { ...status, enabled: true, backupCodesLeft: 10 };
      return HttpResponse.json({ backupCodes: CODES });
    }),
    http.post("/api/two-factor/disable", async ({ request }) => {
      sent.push({ method: "POST", path: "disable", body: await request.json() });
      status = { ...status, enabled: false };
      return new HttpResponse(null, { status: 204 });
    }),
    http.post("/api/two-factor/backup-codes", async ({ request }) => {
      sent.push({ method: "POST", path: "backup-codes", body: await request.json() });
      return HttpResponse.json({ backupCodes: CODES.map((code) => `new-${code}`) });
    }),
    http.get("/api/two-factor/addresses", () => HttpResponse.json([
      { id: "a1", address: "198.51.100.1", confirmedAt: "2026-11-20T10:00:00.000Z", lastUsedAt: "2026-11-22T10:00:00.000Z" },
    ])),
    http.delete("/api/two-factor/addresses/:id", ({ params }) => {
      sent.push({ method: "DELETE", path: `addresses/${String(params.id)}` });
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return sent;
}

describe("the two-factor section", () => {
  it("turns two-factor sign-in on with a QR code, a key and a code, then shows the backup codes", async () => {
    const sent = serve({ enabled: false });
    renderWithProviders(<TwoFactorSettings />);

    await userEvent.click(await screen.findByRole("button", { name: "Включить" }));
    expect(await screen.findByRole("img", { name: "QR-код для Google Authenticator" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "App Store" })).toHaveAttribute("href", "https://apps.apple.com/app/google-authenticator/id388497605");
    expect(screen.getByRole("link", { name: "Google Play" })).toHaveAttribute("href", "https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2");
    expect(screen.getByText("JBSWY3DPEHPK3PXP")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Код из Google Authenticator"), "123456");

    const list = await screen.findByRole("list", { name: "Резервные коды" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(10);
    expect(screen.getByRole("button", { name: "Скопировать коды" })).toBeInTheDocument();
    expect(sent).toEqual([{ method: "POST", path: "confirm", body: { code: "123456" } }]);
    await userEvent.click(screen.getByRole("button", { name: "Готово" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Включена");
  });

  it("says a wrong setup code does not match", async () => {
    serve({ enabled: false });
    renderWithProviders(<TwoFactorSettings />);

    await userEvent.click(await screen.findByRole("button", { name: "Включить" }));
    await userEvent.type(await screen.findByLabelText("Код из Google Authenticator"), "000000");

    expect(await screen.findByRole("alert")).toHaveTextContent(/Код не подходит/);
  });

  it("issues new backup codes and turns it off with a code", async () => {
    const sent = serve({ enabled: true });
    renderWithProviders(<TwoFactorSettings />);

    await userEvent.click(await screen.findByRole("button", { name: "Новые резервные коды" }));
    await userEvent.type(screen.getByLabelText("Код из Google Authenticator"), "123456");
    expect(await screen.findByText("new-code0-abcde")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Отключить" }));
    await userEvent.click(screen.getByRole("button", { name: "Ввести резервный код" }));
    await userEvent.type(screen.getByLabelText("Резервный код"), "abcde-fghjk");
    await userEvent.click(screen.getByRole("button", { name: "Отключить" }));

    await waitFor(() => expect(sent).toContainEqual({ method: "POST", path: "disable", body: { code: "abcde-fghjk" } }));
    expect(await screen.findByRole("button", { name: "Включить" })).toBeInTheDocument();
  });

  it("offers no way to turn it off when the organization requires it", async () => {
    serve({ enabled: true, required: true });
    renderWithProviders(<TwoFactorSettings />);

    expect(await screen.findByText(/Организация требует двухфакторную защиту/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Отключить" })).not.toBeInTheDocument();
  });

  it("lists trusted addresses and forgets one", async () => {
    const sent = serve({ enabled: true });
    renderWithProviders(<TwoFactorSettings />);

    const list = await screen.findByRole("list", { name: "Доверенные адреса" });
    expect(within(list).getByText("198.51.100.1")).toBeInTheDocument();
    await userEvent.click(within(list).getByRole("button", { name: "Забыть 198.51.100.1" }));

    await waitFor(() => expect(sent).toContainEqual({ method: "DELETE", path: "addresses/a1" }));
  });
});

describe("the setup screen", () => {
  it("asks an employee to turn it on and offers to sign out", async () => {
    serve({ enabled: false, required: true });
    renderWithProviders(<TwoFactorSetupScreen />);

    expect(screen.getByRole("heading", { name: "Включите двухфакторную защиту" })).toBeInTheDocument();
    expect(screen.getByText(/Ваша организация требует/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Выйти" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Включить" })).toBeInTheDocument();
  });
});

describe("the employee directory for an admin", () => {
  const member = {
    id: "membership-2", userId: "user-2", name: "Мария", email: "maria@acme.by",
    image: null, phone: null, telegram: null, role: "MANAGER", status: "ACTIVE", createdAt: "2026-08-31T10:00:00.000Z",
  };

  function directory() {
    const sent: Array<{ method: string; path: string; body?: unknown }> = [];
    server.use(
      http.get("/api/auth/me", () => HttpResponse.json(aSession())),
      http.get("/api/members", () => HttpResponse.json([member])),
      http.get("/api/members/:id/access", () => HttpResponse.json([])),
      http.get("/api/projects", () => HttpResponse.json([])),
      http.get("/api/organization/two-factor", () => HttpResponse.json({ required: false, enrolledMembershipIds: ["membership-2"] })),
      http.put("/api/organization/two-factor", async ({ request }) => {
        sent.push({ method: "PUT", path: "organization", body: await request.json() });
        return HttpResponse.json({ required: true });
      }),
      http.post("/api/organization/two-factor/members/:id/reset", ({ params }) => {
        sent.push({ method: "POST", path: `reset/${String(params.id)}` });
        return new HttpResponse(null, { status: 204 });
      }),
    );
    return sent;
  }

  it("requires two-factor sign-in for employees", async () => {
    const sent = directory();
    renderWithProviders(<EmployeeDirectory />);

    await userEvent.click(await screen.findByRole("switch", { name: "Обязательная двухфакторная защита для сотрудников" }));

    await waitFor(() => expect(sent).toContainEqual({ method: "PUT", path: "organization", body: { required: true } }));
  });

  it("resets an enrolled member's second factor after a confirmation", async () => {
    const sent = directory();
    renderWithProviders(<EmployeeDirectory />);

    await userEvent.click(await screen.findByRole("button", { name: "Сбросить двухфакторную защиту" }));
    expect(sent).toEqual([]);
    await userEvent.click(await screen.findByRole("button", { name: "Сбросить" }));

    await waitFor(() => expect(sent).toContainEqual({ method: "POST", path: "reset/membership-2" }));
  });
});

describe("the platform reset", () => {
  it("resets an account by email and says when none uses it", async () => {
    const asked: string[] = [];
    server.use(http.post("/api/platform/two-factor/reset", async ({ request }) => {
      const { email } = await request.json() as { email: string };
      asked.push(email);
      return email === "ghost@acme.com"
        ? HttpResponse.json({ error: { message: "No account" } }, { status: 404 })
        : new HttpResponse(null, { status: 204 });
    }));
    renderWithProviders(<PlatformTwoFactorReset />);

    await userEvent.click(screen.getByRole("button", { name: "Сбросить 2FA" }));
    const dialog = await screen.findByRole("dialog", { name: "Сбросить двухфакторную защиту" });
    await userEvent.type(within(dialog).getByLabelText("Email"), "ghost@acme.com");
    await userEvent.click(within(dialog).getByRole("button", { name: "Сбросить" }));
    expect(await within(dialog).findByText("Аккаунт с таким email не найден")).toBeInTheDocument();

    await userEvent.clear(within(dialog).getByLabelText("Email"));
    await userEvent.type(within(dialog).getByLabelText("Email"), "owner@acme.com");
    await userEvent.click(within(dialog).getByRole("button", { name: "Сбросить" }));
    await waitFor(() => expect(asked).toEqual(["ghost@acme.com", "owner@acme.com"]));
  });
});
