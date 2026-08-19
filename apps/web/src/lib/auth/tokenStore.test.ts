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
