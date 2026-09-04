import { getPng, putPng } from "#shared/infrastructure/storage.js";
import type { ProfileStorage } from "../application/ports.js";

interface PngStorage {
  putPng(key: string, body: Uint8Array): Promise<void>;
  getPng(key: string): Promise<Uint8Array>;
}

const productionStorage: PngStorage = {
  putPng: (key, body) => putPng(key, Buffer.from(body)),
  getPng,
};

export class ProfileStorageAdapter implements ProfileStorage {
  constructor(private readonly storage: PngStorage = productionStorage) {}

  async readAvatar(userId: string): Promise<string | null> {
    try {
      const bytes = await this.storage.getPng(`users/${userId}/avatar.png`);
      return `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`;
    } catch {
      return null;
    }
  }

  writeAvatar(userId: string, png: Uint8Array): Promise<void> {
    return this.storage.putPng(`users/${userId}/avatar.png`, png);
  }
}
