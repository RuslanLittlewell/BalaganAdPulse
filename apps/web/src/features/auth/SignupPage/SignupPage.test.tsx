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
import { SignupPage } from "./SignupPage.js";

function renderPage() {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={["/signup"]}>
        <AuthProvider>
          <Routes>
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/" element={<span>dashboard</span>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function fill(overrides: Partial<Record<string, string>> = {}) {
  await userEvent.type(screen.getByLabelText("Name"), overrides.name ?? "Alexey");
  await userEvent.type(screen.getByLabelText("Email"), overrides.email ?? "buyer@acme.com");
  await userEvent.type(
    screen.getByLabelText("Password"), overrides.password ?? "hunter2hunter2",
  );
  await userEvent.type(
    screen.getByLabelText("Invite code"), overrides.inviteCode ?? "invite",
  );
}

beforeEach(() => localStorage.clear());

describe("SignupPage", () => {
  it("rejects a password shorter than 8 characters without calling the API", async () => {
    renderPage();
    await fill({ password: "short" });
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(screen.getByText("At least 8 characters")).toBeInTheDocument();
  });

  it("requires a name", async () => {
    renderPage();
    await userEvent.type(screen.getByLabelText("Email"), "buyer@acme.com");
    await userEvent.type(screen.getByLabelText("Password"), "hunter2hunter2");
    await userEvent.type(screen.getByLabelText("Invite code"), "invite");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(screen.getByText("Enter your name")).toBeInTheDocument();
  });

  it("creates the account and lands on the dashboard", async () => {
    server.use(http.post("/api/auth/register", () =>
      HttpResponse.json({ accessToken: makeAccessToken(), refreshToken: "r" })));
    renderPage();
    await fill();
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("dashboard")).toBeInTheDocument();
    expect(readTokens().refreshToken).toBe("r");
  });

  it("shows the invite-code rejection above the form", async () => {
    server.use(http.post("/api/auth/register", () =>
      HttpResponse.json({ error: { message: "Invalid invite code" } }, { status: 403 })));
    renderPage();
    await fill();
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("Invalid invite code")).toBeInTheDocument();
    expect(readTokens()).toEqual({});
  });

  it("links to sign-in", () => {
    renderPage();
    expect(screen.getByRole("link", { name: "Already have an account? Sign in" }))
      .toHaveAttribute("href", "/login");
  });

  it("accepts an email padded with a non-breaking space and sends it trimmed", async () => {
    // See LoginPage.test.tsx for why this must be a non-breaking space rather
    // than a plain one: type="email" inputs already strip ASCII whitespace
    // before React sees the value, so a plain space would pass even without
    // the component's own `.trim()`.
    let sentEmail: string | undefined;
    server.use(http.post("/api/auth/register", async ({ request }) => {
      const body = (await request.json()) as { email: string };
      sentEmail = body.email;
      return HttpResponse.json({ accessToken: makeAccessToken(), refreshToken: "r" });
    }));
    renderPage();
    await fill({ email: " buyer@acme.com" });
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("dashboard")).toBeInTheDocument();
    expect(sentEmail).toBe("buyer@acme.com");
  });

  it("keeps the submit button mounted and disabled while the request is in flight", async () => {
    let resolveRequest: (response: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      resolveRequest = resolve;
    });
    server.use(http.post("/api/auth/register", () => pending));
    renderPage();
    await fill();
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(screen.getByRole("button", { name: "Create account" })).toBeDisabled();

    resolveRequest(HttpResponse.json({ accessToken: makeAccessToken(), refreshToken: "r" }));
    expect(await screen.findByText("dashboard")).toBeInTheDocument();
  });

  it("marks the failure message as an alert", async () => {
    server.use(http.post("/api/auth/register", () =>
      HttpResponse.json({ error: { message: "Invalid invite code" } }, { status: 403 })));
    renderPage();
    await fill();
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid invite code");
  });

  it("shows the generic error message for a network failure, not the raw error text", async () => {
    server.use(http.post("/api/auth/register", () => HttpResponse.error()));
    renderPage();
    await fill();
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("Something went wrong")).toBeInTheDocument();
  });
});
