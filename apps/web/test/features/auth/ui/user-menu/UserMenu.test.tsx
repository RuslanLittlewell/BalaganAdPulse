import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { server } from "@test/shared/index.js";
import { renderWithProviders } from "@test/shared/index.js";
import { createQueryClient } from "@/shared/lib/index.js";
import { readTokens, clearTokens } from "@/shared/lib/index.js";
import { AuthProvider } from "@/features/auth/model/AuthProvider.js";
import { UserMenu } from "@/features/auth/ui/user-menu/UserMenu.js";

beforeEach(() => localStorage.clear());

describe("UserMenu", () => {
  it("shows the signed-in name", () => {
    renderWithProviders(<UserMenu />);
    expect(screen.getByText("Buyer")).toBeInTheDocument();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("opens the account actions", async () => {
    renderWithProviders(<UserMenu />);
    await userEvent.click(screen.getByRole("button", { name: /Buyer/ }));

    expect(screen.getByRole("menuitem", { name: "Настройки" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Выйти" })).toBeInTheDocument();
  });

  it("signs out and clears the tokens", async () => {
    server.use(http.post("/api/auth/logout", () => new HttpResponse(null, { status: 204 })));
    renderWithProviders(<UserMenu />);

    await userEvent.click(screen.getByRole("button", { name: /Buyer/ }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Выйти" }));
    expect(readTokens()).toEqual({});
  });

  it("shows a loader when a session exists but the access token is not yet readable", () => {
    // A refresh token with no access token: the rare start-up pause the
    // design doc calls out, before the first silent renewal completes.
    clearTokens();
    localStorage.setItem("adpulse.refreshToken", "r");

    render(
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter>
          <AuthProvider>
            <UserMenu />
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Выйти" })).not.toBeInTheDocument();
  });

  it("renders nothing when there is genuinely no session", () => {
    renderWithProviders(<UserMenu />, { signedIn: false });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Выйти" })).not.toBeInTheDocument();
  });
});
