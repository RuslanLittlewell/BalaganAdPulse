export const MAX_COMMENT_LENGTH = 5000;

export function uniqueIds(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}
