import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { makeAccessToken, server } from "@test/shared/index.js";
import { createQueryClient, hasSession, writeTokens } from "@/shared/lib/index.js";
import { AuthProvider } from "@/features/auth/index.js";
import { AlertsProvider } from "@/shared/ui/index.js";
import { LoginPage } from "@/pages/login/LoginPage.js";
import { TrialConfirmPage, TrialPage } from "@/pages/trial/index.js";

function renderAt(pathname: string) {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[pathname]}>
        <AlertsProvider>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/trial" element={<TrialPage />} />
              <Route path="/trial/confirm/:token" element={<TrialConfirmPage />} />
              <Route path="/" element={<span>dashboard</span>} />
            </Routes>
          </AuthProvider>
        </AlertsProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => localStorage.clear());

async function fill(user: ReturnType<typeof userEvent.setup>, overrides: Partial<Record<string, string>> = {}) {
  const values = {
    "Название организации": "Acme Ads",
    "Ваше имя": "Olga",
    Email: " olga@acme.com ",
    Пароль: "hunter2hunter2",
    "Повторите пароль": "hunter2hunter2",
    ...overrides,
  };
  for (const [label, value] of Object.entries(values)) await user.type(screen.getByLabelText(label), value);
}

const submit = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole("button", { name: "Начать пробный период" }));

describe("the sign-in form", () => {
  it("leads to the trial page", async () => {
    const user = userEvent.setup();
    renderAt("/login");

    await user.click(screen.getByRole("link", { name: "Попробовать бесплатно" }));

    expect(await screen.findByRole("heading", { name: "Пробный период" })).toBeInTheDocument();
  });
});

describe("asking for a trial", () => {
  it("sends the details and says a link is on its way", async () => {
    const user = userEvent.setup();
    let asked: unknown = null;
    server.use(http.post("/api/trial-signups", async ({ request }) => {
      asked = await request.json();
      return new HttpResponse(null, { status: 202 });
    }));
    renderAt("/trial");

    await fill(user);
    await submit(user);

    expect(await screen.findByText(/мы отправили на него ссылку для подтверждения/)).toBeInTheDocument();
    expect(asked).toEqual({
      organizationName: "Acme Ads", name: "Olga", email: "olga@acme.com", password: "hunter2hunter2",
    });
    expect(screen.getByRole("link", { name: "Вернуться ко входу" })).toHaveAttribute("href", "/login");
  });

  it("says so against the confirmation when the passwords differ, and sends nothing", async () => {
    const user = userEvent.setup();
    let asked = false;
    server.use(http.post("/api/trial-signups", () => { asked = true; return new HttpResponse(null, { status: 202 }); }));
    renderAt("/trial");

    await fill(user, { "Повторите пароль": "hunter2hunter" });
    await submit(user);

    expect(await screen.findByText("Пароли не совпадают")).toBeInTheDocument();
    expect(screen.getByLabelText("Повторите пароль")).toHaveAccessibleDescription("Пароли не совпадают");
    expect(asked).toBe(false);
  });

  it("refuses a password shorter than 8 characters", async () => {
    const user = userEvent.setup();
    renderAt("/trial");

    await fill(user, { Пароль: "short", "Повторите пароль": "short" });
    await submit(user);

    expect(await screen.findByText("Минимум 8 символов")).toBeInTheDocument();
  });

  it("refuses an empty organization and a malformed email", async () => {
    const user = userEvent.setup();
    let asked = false;
    server.use(http.post("/api/trial-signups", () => { asked = true; return new HttpResponse(null, { status: 202 }); }));
    renderAt("/trial");

    await fill(user, { "Название организации": " ", Email: "olga@acme" });
    await submit(user);

    expect(await screen.findByText("Введите название организации")).toBeInTheDocument();
    expect(screen.getByText("Введите корректный email")).toBeInTheDocument();
    expect(asked).toBe(false);
  });

  it("says signup is unavailable when the server cannot send mail", async () => {
    const user = userEvent.setup();
    server.use(http.post("/api/trial-signups", () =>
      HttpResponse.json({ error: { message: "Trial signup is not available" } }, { status: 503 })));
    renderAt("/trial");

    await fill(user);
    await submit(user);

    expect(await screen.findByText("Регистрация сейчас недоступна. Обратитесь к администратору."))
      .toBeInTheDocument();
  });

  it("takes a signed-in visitor into the app", async () => {
    writeTokens({ accessToken: makeAccessToken(), refreshToken: "r" });
    renderAt("/trial");

    expect(await screen.findByText("dashboard")).toBeInTheDocument();
  });
});

describe("confirming from the link", () => {
  it("confirms once and enters the app", async () => {
    let confirmed: unknown[] = [];
    server.use(http.post("/api/trial-signups/:token/confirm", ({ params }) => {
      confirmed.push(params.token);
      return HttpResponse.json({ accessToken: makeAccessToken(), refreshToken: "r" });
    }));
    renderAt("/trial/confirm/abc123");

    expect(await screen.findByText("dashboard")).toBeInTheDocument();
    expect(confirmed).toEqual(["abc123"]);
    expect(hasSession()).toBe(true);
  });

  it("says a dead link is invalid and offers to start again", async () => {
    server.use(http.post("/api/trial-signups/:token/confirm", () =>
      HttpResponse.json({ error: { message: "This trial confirmation link is invalid or has expired" } }, { status: 404 })));
    renderAt("/trial/confirm/old");

    expect(await screen.findByText("Ссылка недействительна или устарела. Начните регистрацию заново."))
      .toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Начать заново" })).toHaveAttribute("href", "/trial");
    expect(hasSession()).toBe(false);
  });
});
