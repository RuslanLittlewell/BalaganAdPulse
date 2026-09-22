import { describe, it, expect, beforeEach } from "vitest";
import { http as mock, HttpResponse } from "msw";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { clearTokens, writeTokens } from "@/shared/lib/index.js";
import { makeAccessToken, server } from "@test/shared/index.js";
import { App } from "@/app/App.js";

function renderAppAt(path: string) {
  window.history.pushState({}, "", path);
  return render(<App />);
}

beforeEach(() => {
  clearTokens();
  window.history.pushState({}, "", "/");
});

describe("App", () => {
  it("loads the staff once, when the dashboard opens", async () => {
    let asked = 0;
    server.use(mock.get("/api/members", () => {
      asked += 1;
      return HttpResponse.json([]);
    }));
    writeTokens({ accessToken: makeAccessToken(), refreshToken: "r" });

    renderAppAt("/");

    await waitFor(() => expect(asked).toBe(1));
  });

  it("sends a signed-out visitor at a dashboard route to the sign-in screen", () => {
    renderAppAt("/clients/c1");

    expect(screen.getByRole("heading", { name: "Вход" })).toBeInTheDocument();
  });

  it("renders the sign-in screen at /login without the dashboard shell", () => {
    renderAppAt("/login");

    expect(screen.getByRole("heading", { name: "Вход" })).toBeInTheDocument();
    expect(screen.queryByText("Проекты")).not.toBeInTheDocument();
  });

  it("sends a bookmark for the removed Team section to the dashboard", async () => {
    writeTokens({ accessToken: makeAccessToken(), refreshToken: "r" });

    renderAppAt("/team");

    await screen.findByRole("link", { name: "Проекты" });
    expect(window.location.pathname).toBe("/");
  });

  it("sends a bookmark for the removed sign-up screen to the sign-in form", () => {
    renderAppAt("/signup");

    expect(screen.getByRole("heading", { name: "Вход" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/login");
  });

  it("renders the dashboard shell for a signed-in visitor at a dashboard route", async () => {
    writeTokens({ accessToken: makeAccessToken(), refreshToken: "r" });

    renderAppAt("/");

    expect(await screen.findByRole("link", { name: "Проекты" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Вход" })).not.toBeInTheDocument();
  });

  it("keeps the outgoing module visible while the incoming one fades in, instead of swapping instantly", async () => {
    writeTokens({ accessToken: makeAccessToken(), refreshToken: "r" });

    renderAppAt("/reports");
    expect(await screen.findByRole("heading", { name: "Отчёты" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("link", { name: "Архив" }));

    expect(screen.getByRole("heading", { name: "Отчёты" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Архив" })).not.toBeInTheDocument();

    await waitFor(() => expect(screen.getByRole("heading", { name: "Архив" })).toBeInTheDocument());
    expect(screen.queryByRole("heading", { name: "Отчёты" })).not.toBeInTheDocument();
  });
});
