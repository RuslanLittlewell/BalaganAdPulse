export const MAX_COVER_BYTES = 10 * 1024 * 1024;

const startsWith = (bytes: Uint8Array, signature: readonly number[], offset = 0) =>
  signature.every((byte, index) => bytes[offset + index] === byte);

export function coverType(bytes: Uint8Array): string | null {
  if (bytes.length === 0 || bytes.length > MAX_COVER_BYTES) return null;
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  return null;
}

export function coverKey(reportId: string): string {
  return `reports/${reportId}/cover`;
}
