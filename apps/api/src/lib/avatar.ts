import { ValidationError } from "../errors.js";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MAX_AVATAR_BYTES = 1024 * 1024;
const MAX_AVATAR_PATH_CHARS = 10_000;

/** What counts as an avatar image, stated once: both users and clients store
 * theirs through the same pipeline, and the rules must not drift apart. */
export function assertAvatarPng(png: Buffer): void {
  if (png.length === 0 || png.length > MAX_AVATAR_BYTES || !png.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new ValidationError("Avatar must be a PNG image up to 1 MB");
  }
}

/** The generator's settings, or a marker for an uploaded image. Stored as JSON
 * so the editor can reopen on the same face it last produced. */
export function assertAvatarPath(avatarPath: string): void {
  if (!avatarPath || avatarPath.length > MAX_AVATAR_PATH_CHARS) {
    throw new ValidationError("Avatar configuration is invalid");
  }
  try {
    JSON.parse(avatarPath);
  } catch {
    throw new ValidationError("Avatar configuration is invalid");
  }
}
