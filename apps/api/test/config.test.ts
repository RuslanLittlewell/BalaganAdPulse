import { describe, it, expect } from "vitest";
import { loadConfig } from "../src/shared/infrastructure/config.js";

describe("loadConfig", () => {
  it("reads both required variables", () => {
    const config = loadConfig({ JWT_SECRET: "s" });
    expect(config).toMatchObject({ jwtSecret: "s" });
    expect(config.storage.bucket).toBe("adpulse-avatars");
  });

  it("throws when JWT_SECRET is missing", () => {
    expect(() => loadConfig({})).toThrow(/JWT_SECRET/);
  });

  it("treats an empty value as missing", () => {
    expect(() => loadConfig({ JWT_SECRET: "" })).toThrow(/JWT_SECRET/);
  });

  it("accepts the .env.example placeholders outside production", () => {
    expect(() => loadConfig({
      JWT_SECRET: "dev-secret-change-me",
    })).not.toThrow();
  });

  it("rejects the placeholder JWT_SECRET in production", () => {
    expect(() => loadConfig({
      NODE_ENV: "production", JWT_SECRET: "dev-secret-change-me",
    })).toThrow(/JWT_SECRET/);
  });

  it("rejects a short JWT_SECRET in production", () => {
    expect(() => loadConfig({
      NODE_ENV: "production", JWT_SECRET: "a".repeat(31),
    })).toThrow(/at least 32 characters/);
  });

  it("accepts real values in production", () => {
    const config = loadConfig({
      NODE_ENV: "production", JWT_SECRET: "a".repeat(32),
    });
    expect(config).toMatchObject({ jwtSecret: "a".repeat(32) });
  });

  it("reads S3-compatible storage settings", () => {
    const config = loadConfig({
      JWT_SECRET: "s",
      S3_ENDPOINT: "https://storage.example.com",
      S3_REGION: "eu-central-1",
      S3_ACCESS_KEY: "key",
      S3_SECRET_KEY: "secret",
      S3_BUCKET: "avatars",
    });
    expect(config.storage).toEqual({
      endpoint: "https://storage.example.com",
      region: "eu-central-1",
      accessKey: "key",
      secretKey: "secret",
      bucket: "avatars",
    });
  });

  it("leaves mail off until an SMTP account is given", () => {
    expect(loadConfig({ JWT_SECRET: "s", SMTP_USER: "robot@gmail.com" }).mail).toBeNull();
  });

  it("defaults mail to Google's SMTP server over TLS", () => {
    expect(loadConfig({ JWT_SECRET: "s", SMTP_USER: "robot@gmail.com", SMTP_PASSWORD: "app-password" }).mail).toEqual({
      host: "smtp.gmail.com", port: 465, user: "robot@gmail.com", password: "app-password",
      from: "Balagan BI <robot@gmail.com>",
    });
  });

  it("takes another server, port and sender when given", () => {
    expect(loadConfig({
      JWT_SECRET: "s", SMTP_USER: "u", SMTP_PASSWORD: "p",
      SMTP_HOST: "smtp.example.com", SMTP_PORT: "587", MAIL_FROM: "Robot <robot@example.com>",
    }).mail).toMatchObject({ host: "smtp.example.com", port: 587, from: "Robot <robot@example.com>" });
  });

  it("refuses an SMTP port that is not a number", () => {
    expect(() => loadConfig({ JWT_SECRET: "s", SMTP_USER: "u", SMTP_PASSWORD: "p", SMTP_PORT: "smtp" }))
      .toThrow(/SMTP_PORT/);
  });

  it("builds links on APP_URL, defaulting to the dev server only outside production", () => {
    expect(loadConfig({ JWT_SECRET: "s" }).appUrl).toBe("http://localhost:5173");
    expect(loadConfig({ JWT_SECRET: "s", APP_URL: "https://bi.example.com/" }).appUrl).toBe("https://bi.example.com");
    expect(loadConfig({ NODE_ENV: "production", JWT_SECRET: "a".repeat(32) }).appUrl).toBeNull();
  });
});
