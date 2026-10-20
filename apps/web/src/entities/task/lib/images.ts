export const TASK_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;

export const MAX_TASK_IMAGE_BYTES = 10 * 1024 * 1024;

export type ImageRefusal = "wrongType" | "tooLarge";

export function imageRefusal(file: Pick<Blob, "type" | "size">): ImageRefusal | null {
  if (!(TASK_IMAGE_TYPES as readonly string[]).includes(file.type)) return "wrongType";
  if (file.size > MAX_TASK_IMAGE_BYTES) return "tooLarge";
  return null;
}
