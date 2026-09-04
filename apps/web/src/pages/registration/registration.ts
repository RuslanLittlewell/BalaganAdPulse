import { avatarPng } from "@/features/avatar-editor/index.js";
import type { ChosenAvatar } from "./AvatarStep.js";

export const MIN_PASSWORD = 8;

export function optional(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

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
  }
}
