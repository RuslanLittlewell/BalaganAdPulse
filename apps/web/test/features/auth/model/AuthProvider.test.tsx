import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { server } from "@test/shared/index.js";
import { makeAccessToken, makeExpiredAccessToken } from "@test/shared/index.js";
import { createQueryClient } from "@/shared/lib/index.js";
import { http as httpClient } from "@/shared/lib/index.js";
import { writeTokens, readTokens, hasSession } from "@/shared/lib/index.js";
import { endSession, forceRefresh, onSessionExpired } from "@/shared/lib/index.js";
import { AuthProvider, useAuth } from "@/features/auth/model/AuthProvider.js";

function Probe() {
  const { user, organization, role, clientIds, logout, login, register } = useAuth();
  return (
    <div>
      <span data-testid="name">{user?.name ?? "anonymous"}</span>
      <span data-testid="organization">{organization?.name ?? "none"}</span>
      <span data-testid="role">{role ?? "none"}</span>
      <span data-testid="clients">{clientIds.join(",")}</span>
      <button onClick={() => void logout()}>out</button>
      <button onClick={() => void login({ email: "buyer@acme.com", password: "hunter2hunter2" })}>
        in
      </button>
      <button
        onClick={() => void register({
          name: "Buyer", email: "buyer@acme.com", password: "hunter2hunter2", inviteCode: "invite",
        })}
      >
        join
      </button>
    </div>
  );
}

function DataProbe() {
  const query = useQuery({ queryKey: ["clients"], queryFn: () => httpClient.get("/clients") });
  return <span data-testid="query-status">{query.status}</span>;
}

function renderProvider(queryClient: ReturnType<typeof createQueryClient> = createQueryClient()) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/"]}>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Probe />} />
            <Route path="/login" element={<span>login screen</span>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => localStorage.clear());

describe("AuthProvider", () => {
  it("loads the current user from the server without reading the token", async () => {
    writeTokens({ accessToken: makeAccessToken({ name: "Alexey" }), refreshToken: "r" });
    server.use(http.get("/api/auth/me", () => HttpResponse.json({
      user: { id: "user-1", name: "Alexey", email: "buyer@acme.com", image: null },
      organization: { id: "org-1", name: "AdPulse", slug: "adpulse" },
      role: "ADMIN",
      clientIds: [],
    })));
    renderProvider();
    expect(await screen.findByText("Alexey")).toBeInTheDocument();
  });

  it("loads the organization, current role and reachable clients from /auth/me", async () => {
    writeTokens({ accessToken: makeAccessToken(), refreshToken: "r" });
    server.use(http.get("/api/auth/me", () => HttpResponse.json({
      user: { id: "user-1", name: "Buyer", email: "buyer@acme.com", image: null },
      organization: { id: "org-7", name: "North Agency", slug: "north" },
      role: "MANAGER",
      clientIds: ["client-a", "client-b"],
    })));

    renderProvider();

    expect(await screen.findByTestId("organization")).toHaveTextContent("North Agency");
    expect(screen.getByTestId("role")).toHaveTextContent("MANAGER");
    expect(screen.getByTestId("clients")).toHaveTextContent("client-a,client-b");
  });

  it("has no user when nothing is stored", () => {
    renderProvider();
    expect(screen.getByTestId("name")).toHaveTextContent("anonymous");
  });

  it("signs out: revokes, clears and navigates to sign-in", async () => {
    let revoked = false;
    server.use(http.post("/api/auth/logout", () => {
      revoked = true;
      return new HttpResponse(null, { status: 204 });
    }));
    writeTokens({ accessToken: makeAccessToken(), refreshToken: "r" });
    renderProvider();

    await userEvent.click(screen.getByRole("button", { name: "out" }));

    expect(revoked).toBe(true);
    expect(readTokens()).toEqual({});
    expect(screen.getByText("login screen")).toBeInTheDocument();
  });

  it("signs out locally even when the request fails", async () => {
    server.use(http.post("/api/auth/logout", () => HttpResponse.error()));
    writeTokens({ accessToken: makeAccessToken(), refreshToken: "r" });
    renderProvider();

    await userEvent.click(screen.getByRole("button", { name: "out" }));

    expect(readTokens()).toEqual({});
    expect(screen.getByText("login screen")).toBeInTheDocument();
  });

  it("signs out when the cookie is the only marker left", async () => {
    server.use(http.post("/api/auth/logout", () =>
      new HttpResponse(null, {
        status: 204,
        headers: { "Set-Cookie": "adpulse_session=; Max-Age=0; Path=/" },
      })));
    document.cookie = "adpulse_session=1; path=/";
    localStorage.clear();
    renderProvider();

    await userEvent.click(screen.getByRole("button", { name: "out" }));

    expect(screen.getByText("login screen")).toBeInTheDocument();
  });

  it("leaves no marker behind when the revoke request never lands", async () => {
    server.use(http.post("/api/auth/logout", () => HttpResponse.error()));
    document.cookie = "adpulse_session=1; path=/";
    writeTokens({ accessToken: makeAccessToken(), refreshToken: "r" });
    renderProvider();

    await userEvent.click(screen.getByRole("button", { name: "out" }));

    expect(hasSession()).toBe(false);
    expect(screen.getByText("login screen")).toBeInTheDocument();
  });

  it("routes sign-out through endSession, so every sessionExpired subscriber hears about it", async () => {
    server.use(http.post("/api/auth/logout", () => new HttpResponse(null, { status: 204 })));
    writeTokens({ accessToken: makeAccessToken(), refreshToken: "r" });
    renderProvider();

    const extraListener = vi.fn();
    onSessionExpired(extraListener);

    await userEvent.click(screen.getByRole("button", { name: "out" }));

    expect(extraListener).toHaveBeenCalledOnce();
  });

  it("navigates to sign-in when the session expires elsewhere", async () => {
    writeTokens({ accessToken: makeAccessToken(), refreshToken: "r" });
    renderProvider();

    act(() => endSession());

    expect(await screen.findByText("login screen")).toBeInTheDocument();
  });

  it("clears the query cache on sign-in, so the next user does not inherit stale data", async () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(["clients"], [{ id: "stale-from-previous-user" }]);
    server.use(http.post("/api/auth/login", () =>
      HttpResponse.json({ accessToken: makeAccessToken(), refreshToken: "r" })));
    renderProvider(queryClient);

    await userEvent.click(screen.getByRole("button", { name: "in" }));

    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });

  it("clears the query cache on registration too", async () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(["clients"], [{ id: "stale-from-previous-user" }]);
    server.use(http.post("/api/auth/register", () =>
      HttpResponse.json({ accessToken: makeAccessToken(), refreshToken: "r" })));
    renderProvider(queryClient);

    await userEvent.click(screen.getByRole("button", { name: "join" }));

    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });

  it("drops the visitor at /login with an empty cache when a stale token's silent renewal is refused", async () => {
    writeTokens({ accessToken: makeExpiredAccessToken(), refreshToken: "r" });
    server.use(
      http.get("/api/clients", () =>
        HttpResponse.json({ error: { message: "Authentication required" } }, { status: 401 })),
      http.post("/api/auth/refresh", () =>
        HttpResponse.json({ error: { message: "Session expired" } }, { status: 401 })),
    );

    const queryClient = createQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/"]}>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<DataProbe />} />
              <Route path="/login" element={<span>login screen</span>} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText("login screen")).toBeInTheDocument();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });

  it("re-derives the user after a silent renewal elsewhere", async () => {
    writeTokens({ accessToken: makeAccessToken({ name: "Alexey" }), refreshToken: "r" });
    let sessionName = "Alexey";
    server.use(http.post("/api/auth/refresh", () =>
      HttpResponse.json({ accessToken: makeAccessToken({ name: "Renewed" }) })),
    http.get("/api/auth/me", () => HttpResponse.json({
      user: { id: "user-1", name: sessionName, email: "buyer@acme.com", image: null },
      organization: { id: "org-1", name: "AdPulse", slug: "adpulse" },
      role: "ADMIN",
      clientIds: [],
    })));
    renderProvider();
    expect(await screen.findByText("Alexey")).toBeInTheDocument();

    sessionName = "Renewed";
    await act(() => forceRefresh());

    expect(screen.getByTestId("name")).toHaveTextContent("Renewed");
  });
});
