import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { server } from "../../../test/server.js";
import { makeAccessToken } from "../../../test/token.js";
import { createQueryClient } from "../../../lib/queryClient.js";
import { readTokens } from "../../../lib/auth/tokenStore.js";
import { AuthProvider } from "../AuthProvider.js";
import { LoginPage } from "./LoginPage.js";

function renderPage(state?: { from: string }) {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[{ pathname: "/login", state }]}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<span>dashboard</span>} />
            <Route path="/clients/c1" element={<span>client one</span>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => localStorage.clear());

describe("LoginPage", () => {
  it("rejects an invalid email without calling the API", async () => {
    renderPage();
    await userEvent.type(screen.getByLabelText("Email"), "buyer@acme");
    await userEvent.type(screen.getByLabelText("Password"), "hunter2hunter2");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(screen.getByText("Enter a valid email")).toBeInTheDocument();
  });

  it("stores both tokens and lands on the dashboard", async () => {
    server.use(http.post("/api/auth/login", () =>
      HttpResponse.json({ accessToken: makeAccessToken(), refreshToken: "r" })));
    renderPage();

    await userEvent.type(screen.getByLabelText("Email"), "buyer@acme.com");
    await userEvent.type(screen.getByLabelText("Password"), "hunter2hunter2");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("dashboard")).toBeInTheDocument();
    expect(readTokens().refreshToken).toBe("r");
  });

  it("returns to where the visitor was going", async () => {
    server.use(http.post("/api/auth/login", () =>
      HttpResponse.json({ accessToken: makeAccessToken(), refreshToken: "r" })));
    renderPage({ from: "/clients/c1" });

    await userEvent.type(screen.getByLabelText("Email"), "buyer@acme.com");
    await userEvent.type(screen.getByLabelText("Password"), "hunter2hunter2");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("client one")).toBeInTheDocument();
  });

  it("shows the server's message above the form", async () => {
    server.use(http.post("/api/auth/login", () =>
      HttpResponse.json(
        { error: { message: "Invalid email or password" } }, { status: 401 },
      )));
    renderPage();

    await userEvent.type(screen.getByLabelText("Email"), "buyer@acme.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrongwrongwrong");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Invalid email or password")).toBeInTheDocument();
    expect(readTokens()).toEqual({});
  });

  it("links to sign-up", () => {
    renderPage();
    expect(screen.getByRole("link", { name: "No account? Create one" }))
      .toHaveAttribute("href", "/signup");
  });

  it("accepts an email padded with a non-breaking space and sends it trimmed", async () => {
    // A leading/trailing ASCII space is already stripped by the browser's
    // built-in sanitization for type="email" inputs before React ever sees
    // it, which is why this test cannot use a plain space to prove the
    // component trims: it would pass even without the fix. A non-breaking
    // space is not "ASCII whitespace" by that sanitization algorithm, so it
    // survives to the component — exactly the gap `.trim()` must close.
    let sentEmail: string | undefined;
    server.use(http.post("/api/auth/login", async ({ request }) => {
      const body = (await request.json()) as { email: string };
      sentEmail = body.email;
      return HttpResponse.json({ accessToken: makeAccessToken(), refreshToken: "r" });
    }));
    renderPage();

    await userEvent.type(screen.getByLabelText("Email"), " buyer@acme.com");
    await userEvent.type(screen.getByLabelText("Password"), "hunter2hunter2");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("dashboard")).toBeInTheDocument();
    expect(sentEmail).toBe("buyer@acme.com");
  });

  it("keeps the submit button mounted and disabled while the request is in flight", async () => {
    let resolveRequest: (response: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      resolveRequest = resolve;
    });
    server.use(http.post("/api/auth/login", () => pending));
    renderPage();

    await userEvent.type(screen.getByLabelText("Email"), "buyer@acme.com");
    await userEvent.type(screen.getByLabelText("Password"), "hunter2hunter2");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled();

    resolveRequest(HttpResponse.json({ accessToken: makeAccessToken(), refreshToken: "r" }));
    expect(await screen.findByText("dashboard")).toBeInTheDocument();
  });

  it("marks the failure message as an alert", async () => {
    server.use(http.post("/api/auth/login", () =>
      HttpResponse.json({ error: { message: "Invalid email or password" } }, { status: 401 })));
    renderPage();

    await userEvent.type(screen.getByLabelText("Email"), "buyer@acme.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrongwrongwrong");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password");
  });

  it("shows the generic error message for a network failure, not the raw error text", async () => {
    server.use(http.post("/api/auth/login", () => HttpResponse.error()));
    renderPage();

    await userEvent.type(screen.getByLabelText("Email"), "buyer@acme.com");
    await userEvent.type(screen.getByLabelText("Password"), "hunter2hunter2");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Something went wrong")).toBeInTheDocument();
  });
});
