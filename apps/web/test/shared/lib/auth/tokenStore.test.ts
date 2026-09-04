import { describe, it, expect, beforeEach } from "vitest";
import {
  readTokens, writeTokens, writeAccessToken, clearTokens, hasSession,
} from "@/shared/lib/auth/tokenStore.js";

beforeEach(() => localStorage.clear());

describe("tokenStore", () => {
  it("never persists a token pair", () => {
    writeTokens({ accessToken: "a", refreshToken: "r" });
    expect(readTokens()).toEqual({});
    expect(localStorage.getItem("adpulse.accessToken")).toBeNull();
    expect(localStorage.getItem("adpulse.refreshToken")).toBeNull();
  });

  it("does not persist a replacement access token", () => {
    writeTokens({ accessToken: "a", refreshToken: "r" });
    writeAccessToken("a2");
    expect(readTokens()).toEqual({});
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

  it("removes legacy admin credentials", () => {
    localStorage.setItem("admin_credentials", "secret");
    readTokens();
    expect(localStorage.getItem("admin_credentials")).toBeNull();
  });
});

/**
 * The session marker lives in two places: localStorage and a deliberately
 * readable `adpulse_session` cookie. Clearing one and leaving the other is what
 * lets a signed-out visitor walk back in — `hasSession()` answers true from
 * whichever survived, and the guard that decides whether to ask for credentials
 * believes it.
 */
describe("clearing the session marker", () => {
  beforeEach(() => {
    document.cookie = "adpulse_session=1; path=/";
  });

  it("clears the cookie as well as the local marker", () => {
    writeTokens({ accessToken: "a", refreshToken: "r" });
    expect(hasSession()).toBe(true);

    clearTokens();

    expect(hasSession()).toBe(false);
    expect(document.cookie).not.toContain("adpulse_session=1");
  });

  // The revoke request can fail — offline, or refused by the rate limiter that
  // sits on the sign-out route. The local half has to finish regardless.
  it("clears a cookie left behind when the server was never reached", () => {
    localStorage.clear();
    expect(hasSession()).toBe(true);

    clearTokens();

    expect(hasSession()).toBe(false);
  });
});
