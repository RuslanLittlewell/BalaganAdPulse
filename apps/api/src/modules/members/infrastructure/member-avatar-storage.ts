import { getPng } from "#shared/infrastructure/storage.js";
import type { MemberAvatarStorage } from "../application/ports.js";

export class S3MemberAvatarStorage implements MemberAvatarStorage {
  async readAvatar(userId: string): Promise<Uint8Array | null> {
    try {
      return await getPng(`users/${userId}/avatar.png`);
    } catch {
      return null;
    }
  }
}
