import { createHash, randomBytes, randomInt } from "node:crypto";
import { AppError } from "#shared/domain/index.js";
import { encryptionKey, seal, unseal } from "#shared/infrastructure/aes-gcm.js";
import type { TwoFactorSecrets } from "../application/ports.js";
import { normalizeCode } from "../domain/two-factor.js";

const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export class AesTwoFactorSecrets implements TwoFactorSecrets {
  constructor(private readonly encodedKey: string | undefined) {}

  private key(): Buffer {
    const key = encryptionKey(this.encodedKey);
    if (!key) throw new AppError("unavailable", "Two-factor sign-in is not configured on this server");
    return key;
  }

  seal(secret: string, userId: string): string {
    return seal(this.key(), secret, `totp:${userId}`);
  }

  unseal(sealed: string, userId: string): string {
    return unseal(this.key(), sealed, `totp:${userId}`);
  }

  hash(value: string): string {
    return createHash("sha256").update(normalizeCode(value)).digest("hex");
  }

  hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  newToken(): string {
    return randomBytes(32).toString("base64url");
  }

  newBackupCodes(count: number): string[] {
    return Array.from({ length: count }, () => {
      const chars = Array.from({ length: 10 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
      return `${chars.slice(0, 5)}-${chars.slice(5)}`;
    });
  }
}
