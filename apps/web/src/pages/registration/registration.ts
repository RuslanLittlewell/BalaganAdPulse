import { avatarPng } from "@/features/avatar-editor/index.js";
import type { ChosenAvatar } from "./AvatarStep.js";

export const MIN_PASSWORD = 8;

/** Nothing typed is nothing given, not an empty string stored as a value. */
export function optional(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Stores the picture chosen before the account existed.
 *
 * Deliberately not fatal. Registration has already succeeded by the time this
 * runs — the account, and for a client its first project, are committed — so a
 * picture that fails to upload must not look like a failed registration. The
 * member can set one from their profile.
 */
export async function saveChosenAvatar(
  avatar: ChosenAvatar,
  save: (png: Blob, avatarPath: string) => Promise<void>,
): Promise<void> {
  try {
    if (avatar.file != null) {
      await save(avatar.file, "");
      return;
    }
    if (avatar.options != null) {
      await save(await avatarPng(avatar.options), JSON.stringify(avatar.options));
    }
  } catch {
    // Left unset rather than failing the registration behind it.
  }
}
