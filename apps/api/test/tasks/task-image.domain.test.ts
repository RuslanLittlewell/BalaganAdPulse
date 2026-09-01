import { describe, expect, it } from "vitest";
import {
  MAX_TASK_IMAGE_BYTES,
  assertUploadableImage,
  detectImageType,
} from "../../src/modules/tasks/domain/image.js";

const png = () => Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const jpeg = () => Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const gif = () => Buffer.from([...Buffer.from("GIF89a"), 1, 2, 3]);
const webp = () => Buffer.concat([
  Buffer.from("RIFF"), Buffer.from([0, 0, 0, 0]), Buffer.from("WEBP"), Buffer.from([1, 2, 3]),
]);
const pdf = () => Buffer.from([...Buffer.from("%PDF-1.7"), 1, 2, 3]);

describe("recognising an image", () => {
  it("reads the type from the bytes, not from a name or a declared type", () => {
    expect(detectImageType(png())).toBe("image/png");
    expect(detectImageType(jpeg())).toBe("image/jpeg");
    expect(detectImageType(gif())).toBe("image/gif");
    expect(detectImageType(webp())).toBe("image/webp");
  });

  it("does not recognise anything else", () => {
    expect(detectImageType(pdf())).toBeNull();
    expect(detectImageType(Buffer.from("hello there"))).toBeNull();
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
  });

  it("does not mistake a RIFF container that is not WebP", () => {
    const wav = Buffer.concat([
      Buffer.from("RIFF"), Buffer.from([0, 0, 0, 0]), Buffer.from("WAVE"),
    ]);
    expect(detectImageType(wav)).toBeNull();
  });
});

describe("accepting an upload", () => {
  it("accepts each of the four types and reports what it is", () => {
    expect(assertUploadableImage(png())).toBe("image/png");
    expect(assertUploadableImage(jpeg())).toBe("image/jpeg");
    expect(assertUploadableImage(gif())).toBe("image/gif");
    expect(assertUploadableImage(webp())).toBe("image/webp");
  });

  it("refuses a file that is not an image, however it is named", () => {
    expect(() => assertUploadableImage(pdf())).toThrow(/image/i);
  });

  it("refuses an empty upload", () => {
    expect(() => assertUploadableImage(Buffer.alloc(0))).toThrow(/image/i);
  });

  it("refuses anything over ten megabytes", () => {
    const huge = Buffer.concat([png(), Buffer.alloc(MAX_TASK_IMAGE_BYTES)]);
    expect(() => assertUploadableImage(huge)).toThrow(/too large/i);
  });

  it("accepts a file exactly at the limit", () => {
    const atLimit = Buffer.concat([png(), Buffer.alloc(MAX_TASK_IMAGE_BYTES - png().length)]);
    expect(atLimit.length).toBe(MAX_TASK_IMAGE_BYTES);
    expect(assertUploadableImage(atLimit)).toBe("image/png");
  });
});
