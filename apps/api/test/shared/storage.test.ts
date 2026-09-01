import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { getObject, getPng, putObject, putPng } from "../../src/shared/infrastructure/storage.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";

afterAll(() => prisma.$disconnect());

/** A one-pixel JPEG: enough bytes to prove the content type survives a round
 * trip without the object being a PNG. */
const JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==",
  "base64",
);
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

describe("object storage", () => {
  it("round-trips a JPEG and reports the content type it was stored with", async () => {
    const key = `tasks/${randomUUID()}.jpg`;
    await putObject(key, JPEG, "image/jpeg");
    const stored = await getObject(key);

    expect(Buffer.from(stored.body)).toEqual(JPEG);
    expect(stored.contentType).toBe("image/jpeg");
  });

  it("round-trips a WebP under its own content type", async () => {
    const key = `tasks/${randomUUID()}.webp`;
    await putObject(key, JPEG, "image/webp");
    expect((await getObject(key)).contentType).toBe("image/webp");
  });

  it("still stores and reads avatars as PNGs, unchanged", async () => {
    const key = `users/${randomUUID()}/avatar.png`;
    await putPng(key, PNG);
    expect(Buffer.from(await getPng(key))).toEqual(PNG);
  });

  it("reports a missing object by throwing, so callers can treat it as absent", async () => {
    await expect(getObject(`tasks/${randomUUID()}.png`)).rejects.toThrow();
  });
});
