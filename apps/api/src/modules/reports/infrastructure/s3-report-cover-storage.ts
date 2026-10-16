import { getObject, putObject, removeObjects } from "#shared/infrastructure/storage.js";
import type { ReportCoverStorage } from "../application/ports.js";

export class S3ReportCoverStorage implements ReportCoverStorage {
  async write(key: string, bytes: Uint8Array, contentType: string) {
    await putObject(key, Buffer.from(bytes), contentType);
  }

  async read(key: string) {
    try {
      const object = await getObject(key);
      return { body: object.body, contentType: object.contentType ?? "application/octet-stream" };
    } catch {
      return null;
    }
  }

  async remove(key: string) {
    await removeObjects([key]);
  }
}
