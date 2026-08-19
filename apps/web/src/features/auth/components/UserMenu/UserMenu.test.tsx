import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { server } from "../../../../test/server.js";
import { renderWithProviders } from "../../../../test/utils.js";
import { createQueryClient } from "../../../../lib/queryClient.js";
import { readTokens, clearTokens } from "../../../../lib/auth/tokenStore.js";
import { AuthProvider } from "../../AuthProvider.js";
import { UserMenu } from "./UserMenu.js";

beforeEach(() => localStorage.clear());

describe("UserMenu", () => {
  it("shows the signed-in name", () => {
    renderWithProviders(<UserMenu />);
    expect(screen.getByText("Buyer")).toBeInTheDocument();
  });

  it("signs out and clears the tokens", async () => {
    server.use(http.post("/api/auth/logout", () => new HttpResponse(null, { status: 204 })));
    renderWithProviders(<UserMenu />);

    await userEvent.click(screen.getByRole("button", { name: "Log out" }));
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
    expect(screen.queryByRole("button", { name: "Log out" })).not.toBeInTheDocument();
  });

  it("renders nothing when there is genuinely no session", () => {
    renderWithProviders(<UserMenu />, { signedIn: false });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Log out" })).not.toBeInTheDocument();
  });
});
