import { encryptionKey, seal, unseal } from "#shared/infrastructure/aes-gcm.js";
import type { CredentialCipher } from "../application/ports.js";
import { ProviderError } from "../domain/integration.js";

export class AesCredentialCipher implements CredentialCipher {
  constructor(private readonly encodedKey: string | undefined) {}
  private key() {
    const key = encryptionKey(this.encodedKey);
    if (!key) throw new ProviderError("CONFIGURATION");
    return key;
  }
  encrypt(token: string, projectId: string): string {
    return seal(this.key(), token, projectId);
  }
  decrypt(value: string, projectId: string): string {
    try {
      return unseal(this.key(), value, projectId);
    } catch {
      throw new ProviderError("CONFIGURATION");
    }
  }
}
