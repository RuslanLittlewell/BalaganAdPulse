import { createHmac, randomBytes } from "node:crypto";
import type { Totp } from "../application/ports.js";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SECONDS = 30;
const DIGITS = 6;
const WINDOW = 1;

export function base32Encode(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(text: string): Buffer {
  const clean = text.replace(/=+$/, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) throw new Error("Not a base32 string");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function hotp(secret: Buffer, counter: number, digits = DIGITS): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", secret).update(message).digest();
  const offset = digest[digest.length - 1]! & 15;
  const binary = (digest.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits;
  return String(binary).padStart(digits, "0");
}

export function stepAt(now: Date): number {
  return Math.floor(now.getTime() / 1000 / STEP_SECONDS);
}

export class TotpAdapter implements Totp {
  newSecret(): string {
    return base32Encode(randomBytes(20));
  }

  verify(secret: string, code: string, now: Date, lastStep: number | null): number | null {
    const key = base32Decode(secret);
    const current = stepAt(now);
    for (let offset = -WINDOW; offset <= WINDOW; offset++) {
      const step = current + offset;
      if (lastStep !== null && step <= lastStep) continue;
      if (hotp(key, step) === code) return step;
    }
    return null;
  }

  uri(secret: string, account: string, issuer: string): string {
    const label = encodeURIComponent(`${issuer}:${account}`);
    const query = [
      `secret=${secret}`,
      `issuer=${encodeURIComponent(issuer)}`,
      "algorithm=SHA1",
      `digits=${DIGITS}`,
      `period=${STEP_SECONDS}`,
    ].join("&");
    return `otpauth://totp/${label}?${query}`;
  }
}
