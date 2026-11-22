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
import { ResetPasswordPage } from "@/pages/password-reset/index.js";

function renderAt(path: string) {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <AlertsProvider>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/password-reset/:token" element={<ResetPasswordPage />} />
              <Route path="/" element={<span>dashboard</span>} />
            </Routes>
          </AuthProvider>
        </AlertsProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const challengeAnswer = () => HttpResponse.json({ twoFactor: { challenge: "challenge-1", expiresAt: "2026-11-23T10:05:00.000Z" } });

async function signIn() {
  await userEvent.type(screen.getByLabelText("Email или логин"), "olga@acme.com");
  await userEvent.type(screen.getByLabelText("Пароль"), "right-password");
  await userEvent.click(screen.getByRole("button", { name: "Войти" }));
}

beforeEach(() => localStorage.clear());

describe("the code step at sign-in", () => {
  it("asks for the code when the password opens a challenge, and signs in with it", async () => {
    let sent: unknown = null;
    server.use(
      http.post("/api/auth/login", challengeAnswer),
      http.post("/api/auth/two-factor", async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ accessToken: makeAccessToken(), refreshToken: "r" });
      }),
    );
    renderAt("/login");
    await signIn();

    expect(await screen.findByRole("heading", { name: "Подтвердите вход" })).toBeInTheDocument();
    expect(hasSession()).toBe(false);
    await userEvent.type(screen.getByLabelText("Код"), "123456");

    expect(await screen.findByText("dashboard")).toBeInTheDocument();
    expect(sent).toEqual({ challenge: "challenge-1", code: "123456" });
  });

  it("says a wrong code does not match and keeps the form", async () => {
    server.use(
      http.post("/api/auth/login", challengeAnswer),
      http.post("/api/auth/two-factor", () => HttpResponse.json({ error: { message: "bad", details: [{ code: "INVALID_CODE" }] } }, { status: 401 })),
    );
    renderAt("/login");
    await signIn();
    await userEvent.type(await screen.findByLabelText("Код"), "000000");

    expect(await screen.findByRole("alert")).toHaveTextContent(/Код не подходит/);
    expect(screen.getByLabelText("Код")).toHaveAttribute("aria-invalid", "true");
  });

  it("takes a backup code instead", async () => {
    let sent: unknown = null;
    server.use(
      http.post("/api/auth/login", challengeAnswer),
      http.post("/api/auth/two-factor", async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ accessToken: makeAccessToken(), refreshToken: "r" });
      }),
    );
    renderAt("/login");
    await signIn();
    await userEvent.click(await screen.findByRole("button", { name: "Ввести резервный код" }));
    await userEvent.type(screen.getByLabelText("Резервный код"), "abcde-fghjk");
    await userEvent.click(screen.getByRole("button", { name: "Подтвердить" }));

    expect(await screen.findByText("dashboard")).toBeInTheDocument();
    expect(sent).toEqual({ challenge: "challenge-1", code: "abcde-fghjk" });
  });

  it("sends the visitor back to sign in when the challenge has expired", async () => {
    server.use(
      http.post("/api/auth/login", challengeAnswer),
      http.post("/api/auth/two-factor", () => HttpResponse.json({ error: { message: "expired", details: [{ code: "TWO_FACTOR_CHALLENGE_EXPIRED" }] } }, { status: 401 })),
    );
    renderAt("/login");
    await signIn();
    await userEvent.type(await screen.findByLabelText("Код"), "123456");

    expect(await screen.findByRole("alert")).toHaveTextContent("Время на ввод кода вышло");
    await userEvent.click(screen.getByRole("button", { name: "Войти заново" }));
    expect(await screen.findByRole("heading", { name: "Вход" })).toBeInTheDocument();
  });
});

describe("the code step after a reset link", () => {
  it("asks for the code before entering the app", async () => {
    server.use(
      http.get("/api/auth/password-reset/:token", () => new HttpResponse(null, { status: 204 })),
      http.post("/api/auth/password-reset/:token", challengeAnswer),
      http.post("/api/auth/two-factor", () => HttpResponse.json({ accessToken: makeAccessToken(), refreshToken: "r" })),
    );
    renderAt("/password-reset/abc123");
    await userEvent.type(await screen.findByLabelText("Новый пароль"), "brand-new-pass");
    await userEvent.type(screen.getByLabelText("Повторите пароль"), "brand-new-pass");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить пароль" }));

    await userEvent.type(await screen.findByLabelText("Код"), "123456");

    expect(await screen.findByText("dashboard")).toBeInTheDocument();
  });
});
