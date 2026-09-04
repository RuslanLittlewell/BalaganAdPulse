import { getPng, putPng } from "#shared/infrastructure/storage.js";
import type { ProjectPictureStorage } from "../application/ports.js";

function key(projectId: string): string {
  return `projects/${projectId}/avatar.png`;
}

export class S3ProjectPictureStorage implements ProjectPictureStorage {
  async read(projectId: string): Promise<Uint8Array | null> {
    try {
      return await getPng(key(projectId));
    } catch {
      return null;
    }
  }

  async write(projectId: string, png: Uint8Array): Promise<void> {
    await putPng(key(projectId), Buffer.from(png));
  }
}
