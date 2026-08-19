import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { server } from "../../test/server.js";
import { makeAccessToken, makeExpiredAccessToken } from "../../test/token.js";
import { createQueryClient } from "../../lib/queryClient.js";
import { http as httpClient } from "../../lib/http.js";
import { writeTokens, readTokens } from "../../lib/auth/tokenStore.js";
import { endSession, forceRefresh, onSessionExpired } from "../../lib/auth/session.js";
import { AuthProvider, useAuth } from "./AuthProvider.js";

function Probe() {
  const { user, logout, login, register } = useAuth();
  return (
    <div>
      <span data-testid="name">{user?.name ?? "anonymous"}</span>
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

/** Issues a real query through the app's data layer (lib/http.ts), the way a
 * page component would — this is what exercises the seam between http.ts,
 * session.ts and AuthProvider, rather than any one of them in isolation. */
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
  it("reads the current user out of the stored token", () => {
    writeTokens({ accessToken: makeAccessToken({ name: "Alexey" }), refreshToken: "r" });
    renderProvider();
    expect(screen.getByTestId("name")).toHaveTextContent("Alexey");
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
    // The plan's "Done when": a dead refresh token drops the visitor at
    // /login with an empty cache. This exercises the full seam — a query
    // through lib/http.ts triggers session.ts's renewal, which fails and
    // calls endSession(), which AuthProvider turns into navigation and a
    // cache clear — rather than testing any one file in isolation.
    writeTokens({ accessToken: makeExpiredAccessToken(), refreshToken: "r" });
    server.use(http.post("/api/auth/refresh", () =>
      HttpResponse.json({ error: { message: "Session expired" } }, { status: 401 })));

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
    server.use(http.post("/api/auth/refresh", () =>
      HttpResponse.json({ accessToken: makeAccessToken({ name: "Renewed" }) })));
    renderProvider();
    expect(screen.getByTestId("name")).toHaveTextContent("Alexey");

    await act(() => forceRefresh());

    expect(screen.getByTestId("name")).toHaveTextContent("Renewed");
  });
});
