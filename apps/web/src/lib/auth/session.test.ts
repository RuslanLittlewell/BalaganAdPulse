import { describe, it, expect, beforeEach, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server.js";
import { makeAccessToken, makeExpiredAccessToken } from "../../test/token.js";
import { writeTokens, readTokens } from "./tokenStore.js";
import { ensureFreshToken, forceRefresh, onSessionExpired, onTokenRenewed, endSession } from "./session.js";

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

  it("notifies onTokenRenewed listeners with the fresh token after a successful renewal", async () => {
    const renewed = makeAccessToken({ name: "Renewed" });
    server.use(http.post("/api/auth/refresh", () => HttpResponse.json({ accessToken: renewed })));
    writeTokens({ accessToken: makeExpiredAccessToken(), refreshToken: "r" });

    const listener = vi.fn();
    onTokenRenewed(listener);

    await forceRefresh();

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(renewed);
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

  it("does not call endSession a second time when two requests 401 back to back after the session already ended", async () => {
    // Simulates the case from the finding: the first forceRefresh() fails,
    // clears storage and settles; a second, later forceRefresh() call (its
    // inFlight promise already reset to null) finds no refresh token and
    // must not fire the listeners a second time.
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
