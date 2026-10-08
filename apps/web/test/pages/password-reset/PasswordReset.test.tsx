import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { makeAccessToken, server } from "@test/shared/index.js";
import { createQueryClient, hasSession } from "@/shared/lib/index.js";
import { AuthProvider } from "@/features/auth/index.js";
import { AlertsProvider } from "@/shared/ui/index.js";
import { LoginPage } from "@/pages/login/LoginPage.js";
import { RequestResetPage, ResetPasswordPage } from "@/pages/password-reset/index.js";

function renderAt(pathname: string) {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[pathname]}>
        <AlertsProvider>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/password-reset" element={<RequestResetPage />} />
              <Route path="/password-reset/:token" element={<ResetPasswordPage />} />
              <Route path="/" element={<span>dashboard</span>} />
            </Routes>
          </AuthProvider>
        </AlertsProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => localStorage.clear());

describe("forgetting the password on the sign-in form", () => {
  it("leads to recovery with the email already typed", async () => {
    const user = userEvent.setup();
    renderAt("/login");

    await user.type(screen.getByLabelText("Email"), "buyer@acme.com");
    await user.click(screen.getByRole("link", { name: "Забыли пароль?" }));

    expect(await screen.findByRole("heading", { name: "Восстановление пароля" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveValue("buyer@acme.com");
  });
});

describe("asking for a reset link", () => {
  it("sends the email and says a link is on its way if the account exists", async () => {
    const user = userEvent.setup();
    let asked: unknown = null;
    server.use(http.post("/api/auth/password-reset", async ({ request }) => {
      asked = await request.json();
      return new HttpResponse(null, { status: 202 });
    }));
    renderAt("/password-reset");

    await user.type(screen.getByLabelText("Email"), "  buyer@acme.com ");
    await user.click(screen.getByRole("button", { name: "Отправить ссылку" }));

    expect(await screen.findByText(/Если аккаунт с таким email существует/)).toBeInTheDocument();
    expect(asked).toEqual({ email: "buyer@acme.com" });
    expect(screen.getByRole("link", { name: "Вернуться ко входу" })).toHaveAttribute("href", "/login");
  });

  it("refuses something that is not an email without asking", async () => {
    const user = userEvent.setup();
    let asked = false;
    server.use(http.post("/api/auth/password-reset", () => {
      asked = true;
      return new HttpResponse(null, { status: 202 });
    }));
    renderAt("/password-reset");

    await user.type(screen.getByLabelText("Email"), "buyer@acme");
    await user.click(screen.getByRole("button", { name: "Отправить ссылку" }));

    expect(await screen.findByText("Введите корректный email")).toBeInTheDocument();
    expect(asked).toBe(false);
  });

  it("says recovery is unavailable when the server cannot send mail", async () => {
    const user = userEvent.setup();
    server.use(http.post("/api/auth/password-reset", () =>
      HttpResponse.json({ error: { message: "Password recovery is not available" } }, { status: 503 })));
    renderAt("/password-reset");

    await user.type(screen.getByLabelText("Email"), "buyer@acme.com");
    await user.click(screen.getByRole("button", { name: "Отправить ссылку" }));

    expect(await screen.findByText("Восстановление пароля сейчас недоступно. Обратитесь к администратору."))
      .toBeInTheDocument();
  });
});

describe("setting a new password from the link", () => {
  const workingLink = () => server.use(
    http.get("/api/auth/password-reset/:token", () => new HttpResponse(null, { status: 204 })),
  );

  it("sets the password and enters the app", async () => {
    const user = userEvent.setup();
    let sent: { token: unknown; body: unknown } | null = null;
    workingLink();
    server.use(http.post("/api/auth/password-reset/:token", async ({ params, request }) => {
      sent = { token: params.token, body: await request.json() };
      return HttpResponse.json({ accessToken: makeAccessToken(), refreshToken: "r" });
    }));
    renderAt("/password-reset/abc123");

    await user.type(await screen.findByLabelText("Новый пароль"), "brand-new-pass");
    await user.type(screen.getByLabelText("Повторите пароль"), "brand-new-pass");
    await user.click(screen.getByRole("button", { name: "Сохранить пароль" }));

    expect(await screen.findByText("dashboard")).toBeInTheDocument();
    expect(sent).toEqual({ token: "abc123", body: { password: "brand-new-pass" } });
    expect(hasSession()).toBe(true);
  });

  it("says so against the confirmation when the passwords differ, and sends nothing", async () => {
    const user = userEvent.setup();
    let posted = false;
    workingLink();
    server.use(http.post("/api/auth/password-reset/:token", () => {
      posted = true;
      return HttpResponse.json({ accessToken: makeAccessToken(), refreshToken: "r" });
    }));
    renderAt("/password-reset/abc123");

    await user.type(await screen.findByLabelText("Новый пароль"), "brand-new-pass");
    await user.type(screen.getByLabelText("Повторите пароль"), "brand-new-pas");
    await user.click(screen.getByRole("button", { name: "Сохранить пароль" }));

    expect(await screen.findByText("Пароли не совпадают")).toBeInTheDocument();
    expect(screen.getByLabelText("Повторите пароль")).toHaveAccessibleDescription("Пароли не совпадают");
    expect(posted).toBe(false);
  });

  it("refuses a password shorter than 8 characters", async () => {
    const user = userEvent.setup();
    workingLink();
    renderAt("/password-reset/abc123");

    await user.type(await screen.findByLabelText("Новый пароль"), "short");
    await user.type(screen.getByLabelText("Повторите пароль"), "short");
    await user.click(screen.getByRole("button", { name: "Сохранить пароль" }));

    expect(await screen.findByText("Минимум 8 символов")).toBeInTheDocument();
  });

  it("says a dead link is invalid and offers a new one", async () => {
    server.use(http.get("/api/auth/password-reset/:token", () =>
      HttpResponse.json({ error: { message: "This password reset link is invalid or has expired" } }, { status: 404 })));
    renderAt("/password-reset/old");

    expect(await screen.findByText("Ссылка недействительна или устарела. Запросите новую.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Новый пароль")).toBeNull();
    expect(screen.getByRole("link", { name: "Запросить новую ссылку" })).toHaveAttribute("href", "/password-reset");
  });

  it("says the link is invalid when it dies before the form is sent", async () => {
    const user = userEvent.setup();
    workingLink();
    server.use(http.post("/api/auth/password-reset/:token", () =>
      HttpResponse.json({ error: { message: "This password reset link is invalid or has expired" } }, { status: 404 })));
    renderAt("/password-reset/abc123");

    await user.type(await screen.findByLabelText("Новый пароль"), "brand-new-pass");
    await user.type(screen.getByLabelText("Повторите пароль"), "brand-new-pass");
    await user.click(screen.getByRole("button", { name: "Сохранить пароль" }));

    expect(await screen.findByText("Ссылка недействительна или устарела. Запросите новую.")).toBeInTheDocument();
  });
});
