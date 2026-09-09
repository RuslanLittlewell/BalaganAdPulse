import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { CredentialCipher } from "../application/ports.js";
import { MetaError } from "../domain/integration.js";

export class AesCredentialCipher implements CredentialCipher {
  constructor(private readonly encodedKey: string | undefined) {}
  private key() {
    const key = Buffer.from(this.encodedKey ?? "", "base64");
    if (key.length !== 32) throw new MetaError("CONFIGURATION");
    return key;
  }
  encrypt(token: string, projectId: string): string {
    const nonce = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key(), nonce);
    cipher.setAAD(Buffer.from(projectId));
    const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
    return [nonce, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64")).join(".");
  }
  decrypt(value: string, projectId: string): string {
    try {
      const [nonce, tag, encrypted] = value.split(".").map((part) => Buffer.from(part, "base64"));
      const cipher = createDecipheriv("aes-256-gcm", this.key(), nonce);
      cipher.setAAD(Buffer.from(projectId));
      cipher.setAuthTag(tag);
      return Buffer.concat([cipher.update(encrypted), cipher.final()]).toString("utf8");
    } catch {
      throw new MetaError("CONFIGURATION");
    }
  }
}
