import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { writeTokens, clearTokens } from "./lib/auth/tokenStore.js";
import { makeAccessToken } from "./test/token.js";
import { App } from "./App.js";

// App brings its own providers (QueryClientProvider, BrowserRouter,
// AuthProvider), so renderWithProviders — which supplies its own — is not
// usable here. The URL is set with window.history.pushState because App
// uses BrowserRouter rather than MemoryRouter.
function renderAppAt(path: string) {
  window.history.pushState({}, "", path);
  return render(<App />);
}

beforeEach(() => {
  clearTokens();
  window.history.pushState({}, "", "/");
});

describe("App", () => {
  it("sends a signed-out visitor at a dashboard route to the sign-in screen", () => {
    renderAppAt("/clients/c1");

    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });

  it("renders the sign-in screen at /login without the dashboard shell", () => {
    renderAppAt("/login");

    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByText("Clients")).not.toBeInTheDocument();
  });

  it("renders the dashboard shell for a signed-in visitor at a dashboard route", async () => {
    writeTokens({ accessToken: makeAccessToken(), refreshToken: "r" });

    renderAppAt("/");

    expect(await screen.findByText("Clients")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Sign in" })).not.toBeInTheDocument();
  });
});
