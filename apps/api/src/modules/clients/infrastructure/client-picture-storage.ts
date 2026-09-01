import { getPng, putPng } from "../../../shared/infrastructure/storage.js";
import type { ClientPictureStorage } from "../application/ports.js";

/** One object per client, overwritten in place. */
function key(clientId: string): string {
  return `clients/${clientId}/avatar.png`;
}

export class S3ClientPictureStorage implements ClientPictureStorage {
  async read(clientId: string): Promise<Uint8Array | null> {
    try {
      return await getPng(key(clientId));
    } catch {
      // A picture the storage service cannot serve is a missing picture; the
      // use case turns that into a client with no image rather than an error.
      return null;
    }
  }

  async write(clientId: string, png: Uint8Array): Promise<void> {
    await putPng(key(clientId), Buffer.from(png));
  }
}
