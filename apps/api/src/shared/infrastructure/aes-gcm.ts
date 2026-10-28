import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export function encryptionKey(encoded: string | undefined): Buffer | null {
  const key = Buffer.from(encoded ?? "", "base64");
  return key.length === 32 ? key : null;
}

export function seal(key: Buffer, plain: string, boundTo: string): string {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(Buffer.from(boundTo));
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [nonce, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64")).join(".");
}

export function unseal(key: Buffer, value: string, boundTo: string): string {
  const [nonce, tag, encrypted] = value.split(".").map((part) => Buffer.from(part, "base64"));
  const cipher = createDecipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(Buffer.from(boundTo));
  cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(encrypted), cipher.final()]).toString("utf8");
}
