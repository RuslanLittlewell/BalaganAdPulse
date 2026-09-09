import { randomUUID } from "node:crypto";
import { afterAll, expect, it, vi } from "vitest";
import { S3CreativeFiles } from "../../src/modules/integrations/infrastructure/creative-files.js";
import { getObject } from "../../src/shared/infrastructure/storage.js";
import { prisma } from "../../src/shared/infrastructure/prisma.js";

afterAll(() => prisma.$disconnect());

const png = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
const ok = (body: Buffer, contentType = "image/png") =>
  new Response(body, { headers: { "content-type": contentType, "content-length": String(body.length) } });

it("copies a creative file into storage and reads it back", async () => {
  const fetcher = vi.fn(async () => ok(png));
  const files = new S3CreativeFiles(fetcher);

  const stored = await files.copy("https://cdn.invalid/one.png", "IMAGE");

  expect(stored).toMatchObject({ contentType: "image/png", bytes: png.length });
  expect(Buffer.from((await getObject(stored!.key)).body)).toEqual(png);
});

it("keeps the same key for the same source and does not fetch it twice", async () => {
  const fetcher = vi.fn(async () => ok(png));
  const files = new S3CreativeFiles(fetcher);

  const source = `https://cdn.invalid/${randomUUID()}.png`;
  const first = await files.copy(source, "IMAGE");
  const second = await files.copy(source, "IMAGE");

  expect(second?.key).toBe(first?.key);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("refuses a file beyond the limit for its kind", async () => {
  const huge = Buffer.alloc(11 * 1024 * 1024, 1);
  const files = new S3CreativeFiles(vi.fn(async () => ok(huge, "image/jpeg")));

  expect(await files.copy("https://cdn.invalid/huge.jpg", "IMAGE")).toBeNull();
});

it("allows a video larger than the image limit, up to its own", async () => {
  const video = Buffer.alloc(11 * 1024 * 1024, 2);
  const files = new S3CreativeFiles(vi.fn(async () => ok(video, "video/mp4")));

  const stored = await files.copy("https://cdn.invalid/clip.mp4", "VIDEO");

  expect(stored).toMatchObject({ contentType: "video/mp4", bytes: video.length });
});

it("gives nothing back when the source cannot be fetched", async () => {
  const failing = new S3CreativeFiles(vi.fn(async () => { throw new Error("network"); }));
  expect(await failing.copy("https://cdn.invalid/gone.png", "IMAGE")).toBeNull();

  const refused = new S3CreativeFiles(vi.fn(async () => new Response("no", { status: 403 })));
  expect(await refused.copy("https://cdn.invalid/forbidden.png", "IMAGE")).toBeNull();
});

it("refuses a source that is not an http url", async () => {
  const fetcher = vi.fn(async () => ok(png));
  const files = new S3CreativeFiles(fetcher);

  expect(await files.copy("file:///etc/passwd", "IMAGE")).toBeNull();
  expect(fetcher).not.toHaveBeenCalled();
});
