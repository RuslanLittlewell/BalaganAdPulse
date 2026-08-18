import { describe, it, expect } from "vitest";
import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  it("reads both required variables", () => {
    const config = loadConfig({ JWT_SECRET: "s", INVITE_CODE: "c" });
    expect(config).toEqual({ jwtSecret: "s", inviteCode: "c" });
  });

  it("throws when JWT_SECRET is missing", () => {
    expect(() => loadConfig({ INVITE_CODE: "c" })).toThrow(/JWT_SECRET/);
  });

  it("throws when INVITE_CODE is missing", () => {
    expect(() => loadConfig({ JWT_SECRET: "s" })).toThrow(/INVITE_CODE/);
  });

  it("treats an empty value as missing", () => {
    expect(() => loadConfig({ JWT_SECRET: "", INVITE_CODE: "c" })).toThrow(/JWT_SECRET/);
  });

  it("accepts the .env.example placeholders outside production", () => {
    expect(() => loadConfig({
      JWT_SECRET: "dev-secret-change-me", INVITE_CODE: "adpulse-invite",
    })).not.toThrow();
  });

  it("rejects the placeholder JWT_SECRET in production", () => {
    expect(() => loadConfig({
      NODE_ENV: "production", JWT_SECRET: "dev-secret-change-me", INVITE_CODE: "real-code",
    })).toThrow(/JWT_SECRET/);
  });

  it("rejects a short JWT_SECRET in production", () => {
    expect(() => loadConfig({
      NODE_ENV: "production", JWT_SECRET: "a".repeat(31), INVITE_CODE: "real-code",
    })).toThrow(/at least 32 characters/);
  });

  it("rejects the placeholder INVITE_CODE in production", () => {
    expect(() => loadConfig({
      NODE_ENV: "production", JWT_SECRET: "a".repeat(32), INVITE_CODE: "adpulse-invite",
    })).toThrow(/INVITE_CODE/);
  });

  it("accepts real values in production", () => {
    const config = loadConfig({
      NODE_ENV: "production", JWT_SECRET: "a".repeat(32), INVITE_CODE: "real-code",
    });
    expect(config).toEqual({ jwtSecret: "a".repeat(32), inviteCode: "real-code" });
  });
});
