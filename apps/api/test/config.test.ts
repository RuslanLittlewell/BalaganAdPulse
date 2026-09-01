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
});
