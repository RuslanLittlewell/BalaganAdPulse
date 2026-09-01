# Authentication Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the dashboard a sign-in and sign-up screen, keep the session alive by renewing the access token silently, and show who is signed in with a way out.

**Architecture:** Tokens live in `localStorage`. The access token's payload is read — never verified — for the user's name and its expiry, so start-up needs no request. `lib/http.ts` renews before a request whose token is stale and once more after a 401, with all renewals funnelled through a single in-flight promise. A failed renewal is the only thing that ends a session: it clears storage, empties the React Query cache and navigates to sign-in.

**Tech Stack:** React 19, React Router 6, TanStack Query 5, Vite, CSS Modules, Vitest + Testing Library + MSW.

**Spec:** [docs/superpowers/specs/2026-08-13-adpulse-auth-design.md](../specs/2026-08-13-adpulse-auth-design.md)

**Depends on:** [2026-08-13-adpulse-auth-backend.md](2026-08-13-adpulse-auth-backend.md). The endpoints this plan calls do not exist until that plan lands.

## Global Constraints

- **English only** — code, comments, docs, commit messages, and every string in `i18n/en.ts`.
- **Conventional Commits** — `type(scope): subject`, imperative, lowercase, no trailing period.
- **TDD** — the failing test is written and observed failing before the implementation.
- All user-visible copy goes through `t()` from `src/i18n/en.ts`. No literal strings in components.
- Components live in `src/components/<Name>/<Name>.tsx` with a sibling `.module.css` and `.test.tsx`.
- Refresh tokens are not rotated: `POST /api/auth/refresh` answers `{ accessToken }` only.
- The access token is read, never verified. The server is the only authority.
- No new npm dependency is needed or permitted by this plan.
- Run tests with `npm run test:web` from the repository root.
- MSW runs with `onUnhandledRequest: "error"`, so any request a test does not stub fails that test.

---

### Task 1: Reading the access token

**Files:**
- Create: `apps/web/src/lib/auth/jwt.ts`
- Create: `apps/web/src/lib/auth/jwt.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `AccessTokenPayload = { sub: string; name: string; email: string; exp: number }`, `decodeAccessToken(token: string): AccessTokenPayload | null`, `isExpired(payload: AccessTokenPayload, now?: number): boolean`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/lib/auth/jwt.test.ts
import { describe, it, expect } from "vitest";
import { decodeAccessToken, isExpired } from "./jwt.js";

function encode(value: object): string {
  return btoa(JSON.stringify(value))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function token(payload: object): string {
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode(payload)}.signature`;
}

const valid = { sub: "u1", name: "Buyer", email: "buyer@acme.com", exp: 1_800_000_000 };

describe("decodeAccessToken", () => {
  it("reads the claims out of the payload", () => {
    expect(decodeAccessToken(token(valid))).toEqual(valid);
  });

  it("reads a payload whose base64url needs padding", () => {
    const payload = { ...valid, name: "Buyerrr" };
    expect(decodeAccessToken(token(payload))).toEqual(payload);
  });

  it("returns null for something that is not a token", () => {
    expect(decodeAccessToken("nonsense")).toBeNull();
  });

  it("returns null for a payload that is not JSON", () => {
    expect(decodeAccessToken("a.!!!.c")).toBeNull();
  });

  it("returns null when a claim is missing", () => {
    expect(decodeAccessToken(token({ sub: "u1", exp: 1 }))).toBeNull();
  });
});

describe("isExpired", () => {
  const now = 1_000_000_000_000;

  it("is false well before the expiry", () => {
    expect(isExpired({ ...valid, exp: now / 1000 + 600 }, now)).toBe(false);
  });

  it("is true after the expiry", () => {
    expect(isExpired({ ...valid, exp: now / 1000 - 1 }, now)).toBe(true);
  });

  it("is true inside the 30-second margin", () => {
    expect(isExpired({ ...valid, exp: now / 1000 + 10 }, now)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npm run test:web -- jwt`
Expected: FAIL — `Failed to resolve import "./jwt.js"`.

- [ ] **Step 3: Write the implementation**

```ts
// apps/web/src/lib/auth/jwt.ts
export interface AccessTokenPayload {
  sub: string;
  name: string;
  email: string;
  /** Seconds since the epoch, as JWT defines it. */
  exp: number;
}

/** Renew this many milliseconds early, so a token that is valid at the moment
 * of the check cannot expire while the request is in flight. */
const SKEW_MS = 30_000;

function decodeSegment(segment: string): unknown {
  const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  return JSON.parse(atob(padded));
}

/**
 * Reads the payload. This is not verification and must never be treated as
 * such: the signature is not checked here, and the server is the only thing
 * that decides whether a token is good. The payload of an expired token is
 * still readable, which is what lets the sidebar show a name before the first
 * renewal.
 */
export function decodeAccessToken(token: string): AccessTokenPayload | null {
  const segments = token.split(".");
  if (segments.length !== 3) return null;
  try {
    const payload = decodeSegment(segments[1]) as Partial<AccessTokenPayload>;
    const { sub, name, email, exp } = payload;
    if (!sub || !name || !email || typeof exp !== "number") return null;
    return { sub, name, email, exp };
  } catch {
    return null;
  }
}

export function isExpired(payload: AccessTokenPayload, now: number = Date.now()): boolean {
  return payload.exp * 1000 - SKEW_MS <= now;
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npm run test:web -- jwt`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/auth/jwt.ts apps/web/src/lib/auth/jwt.test.ts
git commit -m "feat(auth): read claims and expiry from the access token"
```

---

### Task 2: Token storage

**Files:**
- Create: `apps/web/src/lib/auth/tokenStore.ts`
- Create: `apps/web/src/lib/auth/tokenStore.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `TokenPair = { accessToken: string; refreshToken: string }`, `readTokens(): Partial<TokenPair>`, `writeTokens(pair: TokenPair): void`, `writeAccessToken(token: string): void`, `clearTokens(): void`, `hasSession(): boolean`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/lib/auth/tokenStore.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  readTokens, writeTokens, writeAccessToken, clearTokens, hasSession,
} from "./tokenStore.js";

beforeEach(() => localStorage.clear());

describe("tokenStore", () => {
  it("round-trips a pair", () => {
    writeTokens({ accessToken: "a", refreshToken: "r" });
    expect(readTokens()).toEqual({ accessToken: "a", refreshToken: "r" });
  });

  it("replaces only the access token", () => {
    writeTokens({ accessToken: "a", refreshToken: "r" });
    writeAccessToken("a2");
    expect(readTokens()).toEqual({ accessToken: "a2", refreshToken: "r" });
  });

  it("returns an empty object when nothing is stored", () => {
    expect(readTokens()).toEqual({});
  });

  it("clears both", () => {
    writeTokens({ accessToken: "a", refreshToken: "r" });
    clearTokens();
    expect(readTokens()).toEqual({});
  });

  it("reports a session when a refresh token is present", () => {
    expect(hasSession()).toBe(false);
    writeTokens({ accessToken: "a", refreshToken: "r" });
    expect(hasSession()).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npm run test:web -- tokenStore`
Expected: FAIL — `Failed to resolve import "./tokenStore.js"`.

- [ ] **Step 3: Write the implementation**

```ts
// apps/web/src/lib/auth/tokenStore.ts
const ACCESS_KEY = "adpulse.accessToken";
const REFRESH_KEY = "adpulse.refreshToken";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/** Always read at the moment of use rather than cached at module load, so a
 * sign-in in this tab is visible to every later call. */
export function readTokens(): Partial<TokenPair> {
  const accessToken = localStorage.getItem(ACCESS_KEY);
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  return {
    ...(accessToken ? { accessToken } : {}),
    ...(refreshToken ? { refreshToken } : {}),
  };
}

export function writeTokens(pair: TokenPair): void {
  localStorage.setItem(ACCESS_KEY, pair.accessToken);
  localStorage.setItem(REFRESH_KEY, pair.refreshToken);
}

export function writeAccessToken(token: string): void {
  localStorage.setItem(ACCESS_KEY, token);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

/** The refresh token is what decides this, not the access token: an expired
 * access token is renewable, a missing refresh token is not. */
export function hasSession(): boolean {
  return localStorage.getItem(REFRESH_KEY) !== null;
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npm run test:web -- tokenStore`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/auth/tokenStore.ts apps/web/src/lib/auth/tokenStore.test.ts
git commit -m "feat(auth): store the token pair in local storage"
```

---

### Task 3: Session renewal

**Files:**
- Create: `apps/web/src/lib/auth/session.ts`
- Create: `apps/web/src/lib/auth/session.test.ts`
- Create: `apps/web/src/test/token.ts`

**Interfaces:**
- Consumes: `decodeAccessToken`, `isExpired` (Task 1); `readTokens`, `writeAccessToken`, `clearTokens` (Task 2).
- Produces: `ensureFreshToken(): Promise<string | null>`, `forceRefresh(): Promise<string>`, `onSessionExpired(listener: () => void): () => void`, `endSession(): void`, `SessionExpiredError`; test helper `makeAccessToken(overrides?): string`.

- [ ] **Step 1: Write the test helper**

```ts
// apps/web/src/test/token.ts
function encode(value: object): string {
  return btoa(JSON.stringify(value))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** A token shaped like the real thing. The signature is a placeholder: the
 * browser never verifies it, and no test here talks to the real API. */
export function makeAccessToken(
  overrides: Partial<{ sub: string; name: string; email: string; exp: number }> = {},
): string {
  const payload = {
    sub: "user-1",
    name: "Buyer",
    email: "buyer@acme.com",
    exp: Math.floor(Date.now() / 1000) + 15 * 60,
    ...overrides,
  };
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode(payload)}.signature`;
}

/** An access token that is already past its expiry. */
export function makeExpiredAccessToken(): string {
  return makeAccessToken({ exp: Math.floor(Date.now() / 1000) - 60 });
}
```

- [ ] **Step 2: Write the failing test**

```ts
// apps/web/src/lib/auth/session.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server.js";
import { makeAccessToken, makeExpiredAccessToken } from "../../test/token.js";
import { writeTokens, readTokens } from "./tokenStore.js";
import { ensureFreshToken, forceRefresh, onSessionExpired } from "./session.js";

beforeEach(() => localStorage.clear());

describe("ensureFreshToken", () => {
  it("returns the stored token when it is still fresh", async () => {
    const accessToken = makeAccessToken();
    writeTokens({ accessToken, refreshToken: "r" });
    expect(await ensureFreshToken()).toBe(accessToken);
  });

  it("returns null when there is no session at all", async () => {
    expect(await ensureFreshToken()).toBeNull();
  });

  it("renews an expired token and stores the new one", async () => {
    server.use(http.post("/api/auth/refresh", () =>
      HttpResponse.json({ accessToken: makeAccessToken({ name: "Renewed" }) })));
    writeTokens({ accessToken: makeExpiredAccessToken(), refreshToken: "r" });

    const token = await ensureFreshToken();
    expect(token).toBe(readTokens().accessToken);
    expect(token).not.toBeNull();
  });

  it("renews when the access token is missing but a refresh token is not", async () => {
    server.use(http.post("/api/auth/refresh", () =>
      HttpResponse.json({ accessToken: makeAccessToken() })));
    localStorage.setItem("adpulse.refreshToken", "r");
    await expect(ensureFreshToken()).resolves.toBeTruthy();
  });
});

describe("forceRefresh", () => {
  it("makes one request for three parallel callers", async () => {
    let calls = 0;
    server.use(http.post("/api/auth/refresh", () => {
      calls += 1;
      return HttpResponse.json({ accessToken: makeAccessToken() });
    }));
    writeTokens({ accessToken: makeExpiredAccessToken(), refreshToken: "r" });

    const tokens = await Promise.all([forceRefresh(), forceRefresh(), forceRefresh()]);
    expect(calls).toBe(1);
    expect(new Set(tokens).size).toBe(1);
  });

  it("clears the tokens and notifies when the server refuses", async () => {
    server.use(http.post("/api/auth/refresh", () =>
      HttpResponse.json({ error: { message: "Session expired" } }, { status: 401 })));
    writeTokens({ accessToken: makeExpiredAccessToken(), refreshToken: "r" });

    const listener = vi.fn();
    onSessionExpired(listener);

    await expect(forceRefresh()).rejects.toThrow();
    expect(readTokens()).toEqual({});
    expect(listener).toHaveBeenCalledOnce();
  });

  it("starts a new request after an earlier one settled", async () => {
    let calls = 0;
    server.use(http.post("/api/auth/refresh", () => {
      calls += 1;
      return HttpResponse.json({ accessToken: makeAccessToken() });
    }));
    writeTokens({ accessToken: makeExpiredAccessToken(), refreshToken: "r" });

    await forceRefresh();
    await forceRefresh();
    expect(calls).toBe(2);
  });
});
```

- [ ] **Step 3: Run the test and watch it fail**

Run: `npm run test:web -- session`
Expected: FAIL — `Failed to resolve import "./session.js"`.

- [ ] **Step 4: Write the implementation**

```ts
// apps/web/src/lib/auth/session.ts
import { decodeAccessToken, isExpired } from "./jwt.js";
import { clearTokens, readTokens, writeAccessToken } from "./tokenStore.js";

export class SessionExpiredError extends Error {
  constructor() {
    super("Session expired");
    this.name = "SessionExpiredError";
  }
}

const listeners = new Set<() => void>();

/** Returns an unsubscribe function, so a component can clean up on unmount. */
export function onSessionExpired(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function endSession(): void {
  clearTokens();
  listeners.forEach((listener) => listener());
}

/** Renewal in progress, shared by every caller. A page load with an expired
 * token fires several requests at once, and without this each of them would
 * open its own renewal. */
let inFlight: Promise<string> | null = null;

async function runRefresh(): Promise<string> {
  const { refreshToken } = readTokens();
  if (!refreshToken) {
    endSession();
    throw new SessionExpiredError();
  }
  // A bare fetch on purpose: going through lib/http.ts would make this call's
  // own 401 trigger a renewal, which would trigger a renewal.
  const res = await fetch("/api/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) {
    endSession();
    throw new SessionExpiredError();
  }
  const { accessToken } = (await res.json()) as { accessToken: string };
  writeAccessToken(accessToken);
  return accessToken;
}

export function forceRefresh(): Promise<string> {
  if (!inFlight) {
    inFlight = runRefresh().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

/** The token to send with the next request, renewing first if the stored one
 * is stale. `null` means there is no session and the request goes out bare —
 * which is exactly what sign-in and sign-up need. */
export async function ensureFreshToken(): Promise<string | null> {
  const { accessToken, refreshToken } = readTokens();
  if (accessToken) {
    const payload = decodeAccessToken(accessToken);
    if (payload && !isExpired(payload)) return accessToken;
  }
  if (!refreshToken) return null;
  return forceRefresh();
}
```

- [ ] **Step 5: Run the test and watch it pass**

Run: `npm run test:web -- session`
Expected: PASS, 7 tests.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/auth/session.ts apps/web/src/lib/auth/session.test.ts apps/web/src/test/token.ts
git commit -m "feat(auth): renew the access token through one in-flight request"
```

---

### Task 4: Authenticated requests

**Files:**
- Modify: `apps/web/src/lib/http.ts`
- Modify: `apps/web/src/lib/http.test.ts`

**Interfaces:**
- Consumes: `ensureFreshToken`, `forceRefresh` (Task 3).
- Produces: the same `http` object, now sending `Authorization` and handling a 401 with one repeat.

- [ ] **Step 1: Write the failing test**

Append to `apps/web/src/lib/http.test.ts`:

```ts
import { makeAccessToken, makeExpiredAccessToken } from "../test/token.js";
import { writeTokens } from "./auth/tokenStore.js";

describe("authenticated requests", () => {
  beforeEach(() => localStorage.clear());

  it("sends the stored token", async () => {
    const accessToken = makeAccessToken();
    writeTokens({ accessToken, refreshToken: "r" });
    let seen: string | null = null;
    server.use(http.get("/api/clients", ({ request }) => {
      seen = request.headers.get("authorization");
      return HttpResponse.json([]);
    }));

    await http_.get("/clients");
    expect(seen).toBe(`Bearer ${accessToken}`);
  });

  it("sends no header when there is no session", async () => {
    let seen: string | null = "unset";
    server.use(http.get("/api/clients", ({ request }) => {
      seen = request.headers.get("authorization");
      return HttpResponse.json([]);
    }));

    await http_.get("/clients");
    expect(seen).toBeNull();
  });

  it("renews before the request when the token is stale", async () => {
    const renewed = makeAccessToken({ name: "Renewed" });
    writeTokens({ accessToken: makeExpiredAccessToken(), refreshToken: "r" });
    server.use(
      http.post("/api/auth/refresh", () => HttpResponse.json({ accessToken: renewed })),
      http.get("/api/clients", ({ request }) => {
        expect(request.headers.get("authorization")).toBe(`Bearer ${renewed}`);
        return HttpResponse.json([]);
      }),
    );

    await expect(http_.get("/clients")).resolves.toEqual([]);
  });

  it("repeats exactly once after a 401", async () => {
    const renewed = makeAccessToken({ name: "Renewed" });
    writeTokens({ accessToken: makeAccessToken(), refreshToken: "r" });
    let attempts = 0;
    server.use(
      http.post("/api/auth/refresh", () => HttpResponse.json({ accessToken: renewed })),
      http.get("/api/clients", () => {
        attempts += 1;
        return attempts === 1
          ? HttpResponse.json({ error: { message: "Authentication required" } }, { status: 401 })
          : HttpResponse.json([{ id: "c1" }]);
      }),
    );

    await expect(http_.get("/clients")).resolves.toEqual([{ id: "c1" }]);
    expect(attempts).toBe(2);
  });

  it("gives up after a second 401 instead of looping", async () => {
    writeTokens({ accessToken: makeAccessToken(), refreshToken: "r" });
    let attempts = 0;
    server.use(
      http.post("/api/auth/refresh", () =>
        HttpResponse.json({ accessToken: makeAccessToken() })),
      http.get("/api/clients", () => {
        attempts += 1;
        return HttpResponse.json({ error: { message: "nope" } }, { status: 401 });
      }),
    );

    await expect(http_.get("/clients")).rejects.toMatchObject({ status: 401 });
    expect(attempts).toBe(2);
  });
});
```

Import the module under test as `http_` (or whatever alias the existing file already uses) so it does not collide with MSW's `http`. Match the existing file's imports of `server`, `http` and `HttpResponse`.

- [ ] **Step 2: Run the test and watch it fail**

Run: `npm run test:web -- http`
Expected: FAIL — no `Authorization` header is sent and a 401 is not retried.

- [ ] **Step 3: Write the implementation**

Replace the `request` function in `apps/web/src/lib/http.ts`:

```ts
import { ensureFreshToken, forceRefresh } from "./auth/session.js";

async function send(path: string, init: RequestInit | undefined, token: string | null) {
  return fetch(`/api${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await ensureFreshToken();
  let res = await send(path, init, token);

  // The check above trusts the browser's clock; a clock off by minutes makes an
  // expired token look fresh. Repeating is safe because a 401 comes from the
  // guard, before the request reaches any service, so nothing happened that a
  // repeat would happen twice. The body is a string, so it can be sent again.
  if (res.status === 401 && token !== null) {
    const renewed = await forceRefresh();
    res = await send(path, init, renewed);
  }

  if (!res.ok) {
    let message = res.statusText || "Request failed";
    let details: unknown[] = [];
    try {
      const body = (await res.json()) as ErrorEnvelope;
      if (body.error?.message) message = body.error.message;
      if (Array.isArray(body.error?.details)) details = body.error.details;
    } catch {
      // non-JSON error body; keep the status-based message
    }
    throw new ApiError(message, res.status, details);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
```

The `token !== null` guard is what keeps sign-in from retrying: a 401 from `/auth/login` is the answer, not a stale token.

- [ ] **Step 4: Run the test and watch it pass**

Run: `npm run test:web -- http`
Expected: PASS, including the five new tests.

- [ ] **Step 5: Run the whole web suite**

Run: `npm run test:web`
Expected: FAIL in existing page tests only if they now trigger an unhandled `/api/auth/refresh`. They should not — no test stores a refresh token yet, so `ensureFreshToken` returns null and requests go out bare. If anything else fails, fix it before committing.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/http.ts apps/web/src/lib/http.test.ts
git commit -m "feat(auth): attach the access token and retry once after a 401"
```

---

### Task 5: Loader

**Files:**
- Create: `apps/web/src/components/Loader/Loader.tsx`
- Create: `apps/web/src/components/Loader/Loader.module.css`
- Create: `apps/web/src/components/Loader/Loader.test.tsx`
- Modify: `apps/web/src/i18n/en.ts`
- Modify: `apps/web/src/i18n/en.test.ts`

**Interfaces:**
- Consumes: `t` from `i18n/en.js`.
- Produces: `<Loader label?: string size?: "sm" | "md" />`.

- [ ] **Step 1: Add the copy**

Add to `apps/web/src/i18n/en.ts`:

```ts
  "state.loading": "Loading…",
```

Check `apps/web/src/i18n/en.test.ts` — if it asserts on the key list or count, update it to match.

- [ ] **Step 2: Write the failing test**

```tsx
// apps/web/src/components/Loader/Loader.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Loader } from "./Loader.js";

describe("Loader", () => {
  it("shows the default label", () => {
    render(<Loader />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("shows a given label", () => {
    render(<Loader label="Signing in…" />);
    expect(screen.getByText("Signing in…")).toBeInTheDocument();
  });

  it("announces itself as a status", () => {
    render(<Loader />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
  });

  it("carries the size as a data attribute", () => {
    render(<Loader size="sm" />);
    expect(screen.getByRole("status")).toHaveAttribute("data-size", "sm");
  });
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `npm run test:web -- Loader`
Expected: FAIL — `Failed to resolve import "./Loader.js"`.

- [ ] **Step 4: Write the component**

```tsx
// apps/web/src/components/Loader/Loader.tsx
import { t } from "../../i18n/en.js";
import styles from "./Loader.module.css";

export interface LoaderProps {
  label?: string;
  size?: "sm" | "md";
}

export function Loader({ label, size = "md" }: LoaderProps) {
  return (
    <div className={styles.loader} data-size={size} role="status" aria-live="polite">
      <span className={styles.ring} aria-hidden="true" />
      <span className={styles.label}>{label ?? t("state.loading")}</span>
    </div>
  );
}
```

```css
/* apps/web/src/components/Loader/Loader.module.css */
.loader {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.ring {
  border-radius: 50%;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-accent);
  animation: spin 0.8s linear infinite;
}

.loader[data-size="md"] .ring {
  width: 20px;
  height: 20px;
}

.loader[data-size="sm"] .ring {
  width: 14px;
  height: 14px;
}

.label {
  color: var(--color-text-muted);
  font-size: 14px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* An endless spin is genuinely unpleasant for people with vestibular
   sensitivity; the ring still reads as a ring when it is still. */
@media (prefers-reduced-motion: reduce) {
  .ring {
    animation: none;
  }
}
```

- [ ] **Step 5: Run the test and watch it pass**

Run: `npm run test:web -- Loader`
Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/Loader apps/web/src/i18n
git commit -m "feat(ui): add a loader for busy states"
```

---

### Task 6: CenteredPanel

**Files:**
- Create: `apps/web/src/components/CenteredPanel/CenteredPanel.tsx`
- Create: `apps/web/src/components/CenteredPanel/CenteredPanel.module.css`
- Create: `apps/web/src/components/CenteredPanel/CenteredPanel.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `<CenteredPanel title: string children: ReactNode />`.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/components/CenteredPanel/CenteredPanel.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CenteredPanel } from "./CenteredPanel.js";

describe("CenteredPanel", () => {
  it("renders its title as a heading", () => {
    render(<CenteredPanel title="Sign in">body</CenteredPanel>);
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });

  it("renders its children", () => {
    render(<CenteredPanel title="Sign in"><p>body</p></CenteredPanel>);
    expect(screen.getByText("body")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm run test:web -- CenteredPanel`
Expected: FAIL — the module does not resolve.

- [ ] **Step 3: Write the component**

```tsx
// apps/web/src/components/CenteredPanel/CenteredPanel.tsx
import type { ReactNode } from "react";
import styles from "./CenteredPanel.module.css";

export interface CenteredPanelProps {
  title: string;
  children: ReactNode;
}

/** A card centred on an empty screen. Knows nothing about authentication —
 * a "not found" page will want the same frame. */
export function CenteredPanel({ title, children }: CenteredPanelProps) {
  return (
    <div className={styles.screen}>
      <section className={styles.panel}>
        <h1 className={styles.title}>{title}</h1>
        {children}
      </section>
    </div>
  );
}
```

```css
/* apps/web/src/components/CenteredPanel/CenteredPanel.module.css */
.screen {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg);
  padding: var(--space-4);
}

.panel {
  width: 100%;
  max-width: 360px;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-6);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.title {
  font-size: 20px;
  font-weight: 600;
  color: var(--color-text);
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npm run test:web -- CenteredPanel`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/CenteredPanel
git commit -m "feat(ui): add a centered panel for full-screen forms"
```

---

### Task 7: Auth data layer and provider

**Files:**
- Create: `apps/web/src/features/auth/data/api.ts`
- Create: `apps/web/src/features/auth/AuthProvider.tsx`
- Create: `apps/web/src/features/auth/AuthProvider.test.tsx`
- Modify: `apps/web/src/i18n/en.ts`

**Interfaces:**
- Consumes: `http` (Task 4); `writeTokens`, `clearTokens`, `readTokens` (Task 2); `decodeAccessToken` (Task 1); `onSessionExpired`, `endSession` (Task 3).
- Produces: `authApi.login`, `authApi.register`, `authApi.logout`; `<AuthProvider>`; `useAuth(): { user: AuthUser | null; login; register; logout }` where `AuthUser = { id: string; name: string; email: string }`.

- [ ] **Step 1: Add the copy**

Add to `apps/web/src/i18n/en.ts`:

```ts
  "auth.login.title": "Sign in",
  "auth.signup.title": "Create your account",
  "auth.name.label": "Name",
  "auth.email.label": "Email",
  "auth.password.label": "Password",
  "auth.inviteCode.label": "Invite code",
  "auth.login.submit": "Sign in",
  "auth.signup.submit": "Create account",
  "auth.login.link": "Already have an account? Sign in",
  "auth.signup.link": "No account? Create one",
  "auth.logout": "Log out",
  "auth.email.invalid": "Enter a valid email",
  "auth.password.tooShort": "At least 8 characters",
  "auth.name.required": "Enter your name",
  "auth.inviteCode.required": "Enter your invite code",
```

- [ ] **Step 2: Write the API module**

```ts
// apps/web/src/features/auth/data/api.ts
import { http } from "../../../lib/http.js";
import type { TokenPair } from "../../../lib/auth/tokenStore.js";

export interface RegisterBody {
  name: string;
  email: string;
  password: string;
  inviteCode: string;
}

export interface LoginBody {
  email: string;
  password: string;
}

export const authApi = {
  login: (body: LoginBody) => http.post<TokenPair>("/auth/login", body),
  register: (body: RegisterBody) => http.post<TokenPair>("/auth/register", body),
  logout: (refreshToken: string) => http.post<void>("/auth/logout", { refreshToken }),
};
```

- [ ] **Step 3: Write the failing provider test**

```tsx
// apps/web/src/features/auth/AuthProvider.test.tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { server } from "../../test/server.js";
import { makeAccessToken } from "../../test/token.js";
import { createQueryClient } from "../../lib/queryClient.js";
import { writeTokens, readTokens } from "../../lib/auth/tokenStore.js";
import { endSession } from "../../lib/auth/session.js";
import { AuthProvider, useAuth } from "./AuthProvider.js";

function Probe() {
  const { user, logout } = useAuth();
  return (
    <div>
      <span data-testid="name">{user?.name ?? "anonymous"}</span>
      <button onClick={() => void logout()}>out</button>
    </div>
  );
}

function renderProvider() {
  return render(
    <QueryClientProvider client={createQueryClient()}>
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

  it("navigates to sign-in when the session expires elsewhere", async () => {
    writeTokens({ accessToken: makeAccessToken(), refreshToken: "r" });
    renderProvider();

    act(() => endSession());

    expect(await screen.findByText("login screen")).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run it and watch it fail**

Run: `npm run test:web -- AuthProvider`
Expected: FAIL — `Failed to resolve import "./AuthProvider.js"`.

- [ ] **Step 5: Write the provider**

```tsx
// apps/web/src/features/auth/AuthProvider.tsx
import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { decodeAccessToken } from "../../lib/auth/jwt.js";
import { clearTokens, readTokens, writeTokens } from "../../lib/auth/tokenStore.js";
import { onSessionExpired } from "../../lib/auth/session.js";
import { authApi, type LoginBody, type RegisterBody } from "./data/api.js";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

interface AuthValue {
  user: AuthUser | null;
  login: (body: LoginBody) => Promise<void>;
  register: (body: RegisterBody) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

/** The signed-in user according to the stored access token. The payload of an
 * expired token still parses, which is why a name is on screen before the
 * first renewal rather than after it. */
function currentUser(): AuthUser | null {
  const { accessToken } = readTokens();
  if (!accessToken) return null;
  const payload = decodeAccessToken(accessToken);
  if (!payload) return null;
  return { id: payload.sub, name: payload.name, email: payload.email };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(currentUser);

  const leave = useCallback(() => {
    setUser(null);
    // Without this the next person to sign in on this laptop sees the previous
    // user's clients until React Query refetches.
    queryClient.clear();
    navigate("/login", { replace: true });
  }, [navigate, queryClient]);

  useEffect(() => onSessionExpired(leave), [leave]);

  const value = useMemo<AuthValue>(() => ({
    user,
    login: async (body) => {
      writeTokens(await authApi.login(body));
      setUser(currentUser());
    },
    register: async (body) => {
      writeTokens(await authApi.register(body));
      setUser(currentUser());
    },
    logout: async () => {
      const { refreshToken } = readTokens();
      if (refreshToken) {
        // A network failure must not trap someone in a session they asked to
        // leave; the local half below runs either way.
        try {
          await authApi.logout(refreshToken);
        } catch {
          // ignored on purpose
        }
      }
      clearTokens();
      leave();
    },
  }), [user, leave]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
```

- [ ] **Step 6: Run the test and watch it pass**

Run: `npm run test:web -- AuthProvider`
Expected: PASS, 5 tests.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/auth apps/web/src/i18n
git commit -m "feat(auth): add the auth provider and its endpoints"
```

---

### Task 8: Guarded routes

**Files:**
- Create: `apps/web/src/features/auth/RequireAuth.tsx`
- Create: `apps/web/src/features/auth/RequireAuth.test.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/test/utils.tsx`

**Interfaces:**
- Consumes: `hasSession` (Task 2), `AuthProvider` (Task 7).
- Produces: `<RequireAuth>`; `renderWithProviders(ui, { route?, signedIn? })` with `signedIn` defaulting to `true`.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/features/auth/RequireAuth.test.tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { writeTokens } from "../../lib/auth/tokenStore.js";
import { makeAccessToken } from "../../test/token.js";
import { RequireAuth } from "./RequireAuth.js";

function LoginProbe() {
  const location = useLocation();
  const state = location.state as { from?: string } | null;
  return <span>login from {state?.from ?? "nowhere"}</span>;
}

function renderAt(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/login" element={<LoginProbe />} />
        <Route
          path="/clients/:clientId"
          element={<RequireAuth><span>protected</span></RequireAuth>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => localStorage.clear());

describe("RequireAuth", () => {
  it("redirects to sign-in without a session", () => {
    renderAt("/clients/c1");
    expect(screen.getByText(/^login from/)).toBeInTheDocument();
  });

  it("remembers where the visitor was going", () => {
    renderAt("/clients/c1");
    expect(screen.getByText("login from /clients/c1")).toBeInTheDocument();
  });

  it("renders the page with a session", () => {
    writeTokens({ accessToken: makeAccessToken(), refreshToken: "r" });
    renderAt("/clients/c1");
    expect(screen.getByText("protected")).toBeInTheDocument();
  });

  it("renders the page when only the refresh token survived", () => {
    localStorage.setItem("adpulse.refreshToken", "r");
    renderAt("/clients/c1");
    expect(screen.getByText("protected")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm run test:web -- RequireAuth`
Expected: FAIL — the module does not resolve.

- [ ] **Step 3: Write the guard**

```tsx
// apps/web/src/features/auth/RequireAuth.tsx
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { hasSession } from "../../lib/auth/tokenStore.js";

/** Admits on the presence of a refresh token, not a valid access token: an
 * expired access token is renewable, so start-up costs no request. If the
 * refresh token turns out to be dead, the session-expiry path takes over. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  if (!hasSession()) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }
  return <>{children}</>;
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npm run test:web -- RequireAuth`
Expected: PASS, 4 tests.

- [ ] **Step 5: Restructure the route tree**

`apps/web/src/App.tsx` becomes:

```tsx
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppShell } from "./components/AppShell/AppShell.js";
import { ClientSidebar } from "./features/clients/components/ClientSidebar/ClientSidebar.js";
import { ClientPage } from "./features/clients/ClientPage/ClientPage.js";
import { EmptyRoute } from "./routes/EmptyRoute.js";
import { AuthProvider } from "./features/auth/AuthProvider.js";
import { RequireAuth } from "./features/auth/RequireAuth.js";
import { LoginPage } from "./features/auth/LoginPage/LoginPage.js";
import { SignupPage } from "./features/auth/SignupPage/SignupPage.js";
import { createQueryClient } from "./lib/queryClient.js";

const queryClient = createQueryClient();

/** The shell and its sidebar belong to the signed-in half of the application;
 * the auth screens stand on their own. */
function Dashboard() {
  return (
    <RequireAuth>
      <AppShell sidebar={<ClientSidebar />}>
        <Routes>
          <Route path="/" element={<EmptyRoute />} />
          <Route path="/clients/:clientId" element={<ClientPage />} />
          <Route path="/clients/:clientId/campaigns/:campaignId" element={<ClientPage />} />
        </Routes>
      </AppShell>
    </RequireAuth>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/*" element={<Dashboard />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
```

`LoginPage` and `SignupPage` do not exist until Tasks 9 and 10; this step will not compile until then. Write the imports now and finish the task by running only the tests listed below, which do not import `App`.

- [ ] **Step 6: Sign in by default in the shared render helper**

```tsx
// apps/web/src/test/utils.tsx
import type { ReactElement, ReactNode } from "react";
import { render } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { createQueryClient } from "../lib/queryClient.js";
import { AuthProvider } from "../features/auth/AuthProvider.js";
import { writeTokens, clearTokens } from "../lib/auth/tokenStore.js";
import { makeAccessToken } from "./token.js";

export interface RenderOptions {
  route?: string;
  /** Page tests are about the page, not about getting past the guard, so a
   * live session is the default. A fresh, unexpired token also keeps
   * lib/http.ts from renewing, which MSW would reject as unhandled. */
  signedIn?: boolean;
}

export function renderWithProviders(ui: ReactElement, options?: RenderOptions) {
  if (options?.signedIn === false) {
    clearTokens();
  } else {
    writeTokens({ accessToken: makeAccessToken(), refreshToken: "test-refresh" });
  }

  const client = createQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[options?.route ?? "/"]}>
        <AuthProvider>{ui}</AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

export function hookWrapper() {
  const client = createQueryClient();
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}
```

- [ ] **Step 7: Run the whole web suite**

Run: `npm run test:web`
Expected: PASS for everything except files importing `App.tsx`, which cannot resolve the two pages yet. If a page test now fails on an unhandled `/api/auth/refresh`, its token is being treated as stale — check `makeAccessToken`'s `exp`.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/features/auth apps/web/src/App.tsx apps/web/src/test/utils.tsx
git commit -m "feat(auth): guard the dashboard routes"
```

---

### Task 9: Sign-in page

**Files:**
- Create: `apps/web/src/features/auth/LoginPage/LoginPage.tsx`
- Create: `apps/web/src/features/auth/LoginPage/LoginPage.module.css`
- Create: `apps/web/src/features/auth/LoginPage/LoginPage.test.tsx`

**Interfaces:**
- Consumes: `useAuth` (Task 7), `CenteredPanel` (Task 6), `Loader` (Task 5), `TextField`, `Button`, `isEmail`, `t`.
- Produces: `<LoginPage />` at `/login`.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/features/auth/LoginPage/LoginPage.test.tsx
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
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm run test:web -- LoginPage`
Expected: FAIL — the module does not resolve.

- [ ] **Step 3: Write the page**

```tsx
// apps/web/src/features/auth/LoginPage/LoginPage.tsx
import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { CenteredPanel } from "../../../components/CenteredPanel/CenteredPanel.js";
import { TextField } from "../../../components/TextField/TextField.js";
import { Button } from "../../../components/Button/Button.js";
import { Loader } from "../../../components/Loader/Loader.js";
import { isEmail } from "../../../lib/validation.js";
import { t } from "../../../i18n/en.js";
import { useAuth } from "../AuthProvider.js";
import styles from "./LoginPage.module.css";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string>();
  const [failure, setFailure] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFailure(undefined);
    if (!isEmail(email)) {
      setEmailError(t("auth.email.invalid"));
      return;
    }
    setEmailError(undefined);
    setBusy(true);
    try {
      await login({ email, password });
      navigate(from, { replace: true });
    } catch (error) {
      setFailure(error instanceof Error ? error.message : t("state.error.title"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <CenteredPanel title={t("auth.login.title")}>
      <form className={styles.form} onSubmit={submit} noValidate>
        {failure != null && <p className={styles.failure}>{failure}</p>}
        <TextField
          label={t("auth.email.label")}
          type="email"
          autoComplete="username"
          value={email}
          error={emailError}
          onChange={(event) => setEmail(event.target.value)}
        />
        <TextField
          label={t("auth.password.label")}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {busy ? <Loader size="sm" /> : (
          <Button type="submit">{t("auth.login.submit")}</Button>
        )}
      </form>
      <Link className={styles.link} to="/signup">{t("auth.signup.link")}</Link>
    </CenteredPanel>
  );
}
```

```css
/* apps/web/src/features/auth/LoginPage/LoginPage.module.css */
.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.failure {
  color: var(--color-danger);
  font-size: 14px;
}

.link {
  color: var(--color-text-muted);
  font-size: 14px;
  text-align: center;
}
```

If `t("state.error.title")` does not exist in `en.ts`, use the key that the existing error states already use.

- [ ] **Step 4: Run the test and watch it pass**

Run: `npm run test:web -- LoginPage`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/auth/LoginPage
git commit -m "feat(auth): add the sign-in page"
```

---

### Task 10: Sign-up page

**Files:**
- Create: `apps/web/src/features/auth/SignupPage/SignupPage.tsx`
- Create: `apps/web/src/features/auth/SignupPage/SignupPage.test.tsx`

**Interfaces:**
- Consumes: the same as Task 9, plus `register` from `useAuth`.
- Produces: `<SignupPage />` at `/signup`.

`SignupPage` reuses `LoginPage.module.css` — the two forms are the same shape, and a second identical stylesheet would be a copy to keep in sync.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/features/auth/SignupPage/SignupPage.test.tsx
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
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm run test:web -- SignupPage`
Expected: FAIL — the module does not resolve.

- [ ] **Step 3: Write the page**

```tsx
// apps/web/src/features/auth/SignupPage/SignupPage.tsx
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CenteredPanel } from "../../../components/CenteredPanel/CenteredPanel.js";
import { TextField } from "../../../components/TextField/TextField.js";
import { Button } from "../../../components/Button/Button.js";
import { Loader } from "../../../components/Loader/Loader.js";
import { isEmail } from "../../../lib/validation.js";
import { t } from "../../../i18n/en.js";
import { useAuth } from "../AuthProvider.js";
import styles from "../LoginPage/LoginPage.module.css";

const MIN_PASSWORD = 8;

export function SignupPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFailure(undefined);

    const next: Record<string, string> = {};
    if (name.trim() === "") next.name = t("auth.name.required");
    if (!isEmail(email)) next.email = t("auth.email.invalid");
    if (password.length < MIN_PASSWORD) next.password = t("auth.password.tooShort");
    if (inviteCode.trim() === "") next.inviteCode = t("auth.inviteCode.required");
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    try {
      await register({ name: name.trim(), email, password, inviteCode: inviteCode.trim() });
      navigate("/", { replace: true });
    } catch (error) {
      setFailure(error instanceof Error ? error.message : t("state.error.title"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <CenteredPanel title={t("auth.signup.title")}>
      <form className={styles.form} onSubmit={submit} noValidate>
        {failure != null && <p className={styles.failure}>{failure}</p>}
        <TextField
          label={t("auth.name.label")}
          autoComplete="name"
          value={name}
          error={errors.name}
          onChange={(event) => setName(event.target.value)}
        />
        <TextField
          label={t("auth.email.label")}
          type="email"
          autoComplete="username"
          value={email}
          error={errors.email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <TextField
          label={t("auth.password.label")}
          type="password"
          autoComplete="new-password"
          value={password}
          error={errors.password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <TextField
          label={t("auth.inviteCode.label")}
          value={inviteCode}
          error={errors.inviteCode}
          onChange={(event) => setInviteCode(event.target.value)}
        />
        {busy ? <Loader size="sm" /> : (
          <Button type="submit">{t("auth.signup.submit")}</Button>
        )}
      </form>
      <Link className={styles.link} to="/login">{t("auth.login.link")}</Link>
    </CenteredPanel>
  );
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npm run test:web -- SignupPage`
Expected: PASS, 5 tests.

- [ ] **Step 5: Run the whole web suite**

Run: `npm run test:web`
Expected: PASS — `App.tsx` now resolves both pages.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/auth/SignupPage
git commit -m "feat(auth): add the sign-up page"
```

---

### Task 11: The sidebar footer and one loading language

**Files:**
- Create: `apps/web/src/features/auth/components/UserMenu/UserMenu.tsx`
- Create: `apps/web/src/features/auth/components/UserMenu/UserMenu.module.css`
- Create: `apps/web/src/features/auth/components/UserMenu/UserMenu.test.tsx`
- Modify: `apps/web/src/features/clients/components/ClientSidebar/ClientSidebar.tsx`
- Modify: `apps/web/src/features/clients/components/ClientSidebar/ClientSidebar.module.css`
- Modify: `apps/web/src/features/clients/components/ClientSidebar/ClientSidebar.test.tsx`

**Interfaces:**
- Consumes: `useAuth` (Task 7), `Loader` (Task 5).
- Produces: `<UserMenu />`, passed to `Sidebar`'s existing `footer` prop.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/features/auth/components/UserMenu/UserMenu.test.tsx
import { describe, it, expect, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "../../../../test/server.js";
import { renderWithProviders } from "../../../../test/utils.js";
import { readTokens } from "../../../../lib/auth/tokenStore.js";
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
});
```

`renderWithProviders` signs in with `makeAccessToken()`, whose name is `Buyer`.

- [ ] **Step 2: Run it and watch it fail**

Run: `npm run test:web -- UserMenu`
Expected: FAIL — the module does not resolve.

- [ ] **Step 3: Write the component**

```tsx
// apps/web/src/features/auth/components/UserMenu/UserMenu.tsx
import { t } from "../../../../i18n/en.js";
import { useAuth } from "../../AuthProvider.js";
import styles from "./UserMenu.module.css";

export function UserMenu() {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <div className={styles.menu}>
      <span className={styles.name}>{user.name}</span>
      <button type="button" className={styles.logout} onClick={() => void logout()}>
        {t("auth.logout")}
      </button>
    </div>
  );
}
```

```css
/* apps/web/src/features/auth/components/UserMenu/UserMenu.module.css */
.menu {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  align-items: flex-start;
}

.name {
  color: var(--color-text);
  font-size: 14px;
}

.logout {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  color: var(--color-accent);
  font-size: 14px;
  font-weight: 600;
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npm run test:web -- UserMenu`
Expected: PASS, 2 tests.

- [ ] **Step 5: Write the failing sidebar test**

Add to `apps/web/src/features/clients/components/ClientSidebar/ClientSidebar.test.tsx`:

```tsx
it("shows the signed-in user below the new-client button", () => {
  renderWithProviders(<ClientSidebar />);
  expect(screen.getByText("Buyer")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
});

it("uses the shared loader while the clients load", () => {
  renderWithProviders(<ClientSidebar />);
  expect(screen.getByRole("status")).toHaveTextContent("Loading…");
});
```

The second test asserts on the pending state, which is what the sidebar shows before MSW answers. If the default handler resolves too quickly for that, delay it in this test with `http.get("/api/clients", async () => { await delay(); return HttpResponse.json([]); })` using MSW's `delay`.

- [ ] **Step 6: Run it and watch it fail**

Run: `npm run test:web -- ClientSidebar`
Expected: FAIL — no footer is rendered and the pending state is two grey skeletons.

- [ ] **Step 7: Wire the footer and replace the skeletons**

In `apps/web/src/features/clients/components/ClientSidebar/ClientSidebar.tsx`:

1. Import `UserMenu` and `Loader`.
2. Pass `footer={<UserMenu />}` to `<Sidebar>`.
3. Replace the pending branch:

```tsx
{clients.isPending && (
  <div className={styles.state}>
    <Loader size="sm" />
  </div>
)}
```

4. Delete the `.skeleton` rule and its keyframes from `ClientSidebar.module.css`.

- [ ] **Step 8: Run the sidebar test and watch it pass**

Run: `npm run test:web -- ClientSidebar`
Expected: PASS.

- [ ] **Step 9: Run both suites**

Run: `npm test && npm run test:web`
Expected: PASS in both.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/features
git commit -m "feat(auth): show the signed-in user and a way out in the sidebar"
```

---

## Done when

- `npm run test:web` passes, and so does `npm test`.
- Visiting any dashboard route without a session lands on `/login`, and signing in returns to that route.
- An expired access token is renewed without the user noticing; a dead refresh token drops them at `/login` with an empty cache.
- The sidebar shows the signed-in name and a working `Log out`.
- `Loading…` with the shared ring is the only loading state in the application.
