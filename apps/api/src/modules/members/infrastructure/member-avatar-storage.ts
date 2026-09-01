import { getPng } from "../../../shared/infrastructure/storage.js";
import type { MemberAvatarStorage } from "../application/ports.js";

/** Reads the same object the profile screen writes, so a member's picture is
 * one file however it is being displayed. */
export class S3MemberAvatarStorage implements MemberAvatarStorage {
  async readAvatar(userId: string): Promise<Uint8Array | null> {
    try {
      return await getPng(`users/${userId}/avatar.png`);
    } catch {
      // Absent, or storage is unreachable. Either way the caller draws initials.
      return null;
    }
  }
}
