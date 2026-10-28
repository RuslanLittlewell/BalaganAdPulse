import { AppError } from "#shared/domain/index.js";
import { encryptionKey, seal, unseal } from "#shared/infrastructure/aes-gcm.js";
import type { PasswordCipher } from "../application/ports.js";

const UNAVAILABLE = "Cabinet credentials are not available";
const boundTo = (userId: string) => `client-account:${userId}`;

export class AesPasswordCipher implements PasswordCipher {
  constructor(private readonly encodedKey: string | undefined) {}

  private key() {
    const key = encryptionKey(this.encodedKey);
    if (!key) throw new AppError("unavailable", UNAVAILABLE);
    return key;
  }

  seal(password: string, userId: string): string {
    return seal(this.key(), password, boundTo(userId));
  }

  open(sealed: string, userId: string): string {
    const key = this.key();
    try {
      return unseal(key, sealed, boundTo(userId));
    } catch {
      throw new AppError("unavailable", UNAVAILABLE);
    }
  }
}
