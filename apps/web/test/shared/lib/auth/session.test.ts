import { describe, it, expect, beforeEach, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@test/shared/index.js";
import { makeAccessToken, makeExpiredAccessToken } from "@test/shared/index.js";
import { writeTokens, readTokens, hasSession } from "@/shared/lib/auth/tokenStore.js";
import {
  ensureFreshToken,
  forceRefresh,
  onSessionExpired,
  onTokenRenewed,
  endSession,
  RefreshUnavailableError,
} from "@/shared/lib/auth/session.js";

beforeEach(() => localStorage.clear());

describe("ensureFreshToken", () => {
  it("reports an opaque cookie session without exposing its token", async () => {
    const accessToken = makeAccessToken();
    writeTokens({ accessToken, refreshToken: "r" });
    expect(await ensureFreshToken()).toBe("cookie-session");
    expect(readTokens()).toEqual({});
  });

  it("returns null when there is no session at all", async () => {
    expect(await ensureFreshToken()).toBeNull();
  });

  it("does not decode or renew tokens in JavaScript", async () => {
    server.use(http.post("/api/auth/refresh", () =>
      HttpResponse.json({ accessToken: makeAccessToken({ name: "Renewed" }) })));
    writeTokens({ accessToken: makeExpiredAccessToken(), refreshToken: "r" });

    const token = await ensureFreshToken();
    expect(token).toBe("cookie-session");
    expect(readTokens()).toEqual({});
  });

  it("renews when the access token is missing but a refresh token is not", async () => {
    server.use(http.post("/api/auth/refresh", () =>
      HttpResponse.json({ accessToken: makeAccessToken() })));
    localStorage.setItem("adpulse.hasSession", "1");
    await expect(ensureFreshToken()).resolves.toBe("cookie-session");
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

  it("notifies onTokenRenewed listeners with the fresh token after a successful renewal", async () => {
    const renewed = makeAccessToken({ name: "Renewed" });
    server.use(http.post("/api/auth/refresh", () => HttpResponse.json({ accessToken: renewed })));
    writeTokens({ accessToken: makeExpiredAccessToken(), refreshToken: "r" });

    const listener = vi.fn();
    onTokenRenewed(listener);

    await forceRefresh();

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith("cookie-session");
  });

  it("stops notifying an onTokenRenewed listener after it unsubscribes", async () => {
    server.use(http.post("/api/auth/refresh", () =>
      HttpResponse.json({ accessToken: makeAccessToken() })));
    writeTokens({ accessToken: makeExpiredAccessToken(), refreshToken: "r" });

    const listener = vi.fn();
    const unsubscribe = onTokenRenewed(listener);
    unsubscribe();

    await forceRefresh();

    expect(listener).not.toHaveBeenCalled();
  });

  it("does not notify onTokenRenewed when the server refuses", async () => {
    server.use(http.post("/api/auth/refresh", () =>
      HttpResponse.json({ error: { message: "Session expired" } }, { status: 401 })));
    writeTokens({ accessToken: makeExpiredAccessToken(), refreshToken: "r" });

    const listener = vi.fn();
    onTokenRenewed(listener);

    await expect(forceRefresh()).rejects.toThrow();
    expect(listener).not.toHaveBeenCalled();
  });

  it("leaves the stored tokens in place and does not notify listeners when the refresh endpoint answers 429", async () => {
    server.use(http.post("/api/auth/refresh", () =>
      HttpResponse.json({ error: { message: "Too many requests, try again later" } }, { status: 429 })));
    const accessToken = makeExpiredAccessToken();
    writeTokens({ accessToken, refreshToken: "r" });

    const listener = vi.fn();
    onSessionExpired(listener);

    await expect(forceRefresh()).rejects.toThrow(RefreshUnavailableError);

    expect(readTokens()).toEqual({});
    expect(hasSession()).toBe(true);
    expect(listener).not.toHaveBeenCalled();
  });

  it("does not call endSession a second time when two requests 401 back to back after the session already ended", async () => {
    server.use(http.post("/api/auth/refresh", () =>
      HttpResponse.json({ error: { message: "Session expired" } }, { status: 401 })));
    writeTokens({ accessToken: makeExpiredAccessToken(), refreshToken: "r" });

    const listener = vi.fn();
    onSessionExpired(listener);

    await expect(forceRefresh()).rejects.toThrow();
    await expect(forceRefresh()).rejects.toThrow();

    expect(listener).toHaveBeenCalledOnce();
  });
});

describe("endSession", () => {
  beforeEach(() => localStorage.clear());

  it("does not fire listeners a second time once the session has already ended", () => {
    writeTokens({ accessToken: "a", refreshToken: "r" });
    const listener = vi.fn();
    onSessionExpired(listener);

    endSession();
    endSession();

    expect(listener).toHaveBeenCalledOnce();
  });
});

describe("ending a session that has already lost its markers", () => {
  it("still notifies when forced, with no marker left to find", () => {
    let notified = 0;
    const stop = onSessionExpired(() => { notified += 1; });

    localStorage.clear();
    document.cookie = "adpulse_session=; Max-Age=0; path=/";
    expect(hasSession()).toBe(false);

    endSession({ force: true });

    expect(notified).toBe(1);
    stop();
  });

  it("stays quiet when unforced and no session is left", () => {
    let notified = 0;
    const stop = onSessionExpired(() => { notified += 1; });
    localStorage.clear();

    endSession();

    expect(notified).toBe(0);
    stop();
  });

  it("notifies once per session, not once per call", () => {
    let notified = 0;
    const stop = onSessionExpired(() => { notified += 1; });
    writeTokens({ accessToken: "a", refreshToken: "r" });

    endSession();
    endSession();

    expect(notified).toBe(1);
    stop();
  });

  it("notifies again once a new session has begun", () => {
    let notified = 0;
    const stop = onSessionExpired(() => { notified += 1; });

    writeTokens({ accessToken: "a", refreshToken: "r" });
    endSession();
    writeTokens({ accessToken: "b", refreshToken: "r2" });
    endSession();

    expect(notified).toBe(2);
    stop();
  });
});
