import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { AppError } from "#shared/domain/index.js";
import { encryptionKey, seal, unseal } from "#shared/infrastructure/aes-gcm.js";
import type { Secrets } from "../application/ports.js";

export class Bitrix24Secrets implements Secrets {
  constructor(private readonly encodedKey: string | undefined) {}

  private key(): Buffer {
    const key = encryptionKey(this.encodedKey);
    if (!key) throw new AppError("unavailable", "Integrations are not configured on this server");
    return key;
  }

  seal(value: string, orgId: string): string {
    return seal(this.key(), value, `bitrix24:${orgId}`);
  }

  unseal(value: string, orgId: string): string {
    return unseal(this.key(), value, `bitrix24:${orgId}`);
  }

  hash(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  matches(token: string, hash: string): boolean {
    const given = Buffer.from(this.hash(token), "hex");
    const stored = Buffer.from(hash, "hex");
    return given.length === stored.length && timingSafeEqual(given, stored);
  }

  newKey(): string {
    return randomBytes(32).toString("base64url");
  }
}
