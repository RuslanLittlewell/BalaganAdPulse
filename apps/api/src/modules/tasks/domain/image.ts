import { AppError } from "../../../shared/domain/index.js";

/** Ten megabytes: a screenshot, generously, and small enough that a paste
 * cannot quietly cost a paid megabyte of storage per keystroke. */
export const MAX_TASK_IMAGE_BYTES = 10 * 1024 * 1024;

export type TaskImageType = "image/png" | "image/jpeg" | "image/webp" | "image/gif";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff]);

/**
 * What the bytes actually are.
 *
 * Read from the content rather than from the file name or the declared content
 * type, both of which the uploader chooses: a PDF renamed `.png` is still a
 * PDF, and storing it would put an arbitrary file behind an `<img>` tag.
 */
export function detectImageType(bytes: Buffer): TaskImageType | null {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(PNG)) return "image/png";
  if (bytes.length >= 3 && bytes.subarray(0, 3).equals(JPEG)) return "image/jpeg";
  if (bytes.length >= 6) {
    const header = bytes.subarray(0, 6).toString("latin1");
    if (header === "GIF87a" || header === "GIF89a") return "image/gif";
  }
  // RIFF is a container: only the WEBP form of it is an image.
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("latin1") === "RIFF" &&
    bytes.subarray(8, 12).toString("latin1") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

/** Narrows an upload to something storable, and answers what it is. */
export function assertUploadableImage(bytes: Buffer): TaskImageType {
  if (bytes.length > MAX_TASK_IMAGE_BYTES) {
    throw new AppError("validation", "Image is too large; the limit is 10 MB");
  }
  const type = detectImageType(bytes);
  if (!type) {
    throw new AppError("validation", "Only PNG, JPEG, WebP and GIF images can be uploaded");
  }
  return type;
}
