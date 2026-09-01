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
