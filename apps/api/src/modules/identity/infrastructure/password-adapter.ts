import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { createGate } from "../../../shared/infrastructure/concurrency-gate.js";
import type { PasswordPort } from "../application/ports.js";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number },
) => Promise<Buffer>;

const SALT_BYTES = 16;
const KEY_BYTES = 64;
const PARAMS = { N: 16384, r: 8, p: 1 };

export const scryptGate = createGate({
  maxConcurrent: 2,
  maxQueue: 20,
  maxWaitMs: 5000,
});

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await scryptGate.run(() => scryptAsync(password, salt, KEY_BYTES, PARAMS));
  return `${salt.toString("hex")}:${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, keyHex] = stored.split(":");
  if (!saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, "hex");
  if (expected.length !== KEY_BYTES) return false;
  const key = await scryptGate.run(() =>
    scryptAsync(password, Buffer.from(saltHex, "hex"), KEY_BYTES, PARAMS),
  );
  return timingSafeEqual(expected, key);
}

export class PasswordAdapter implements PasswordPort {
  readonly dummyHash = `${"0123456789abcdef".repeat(2)}:${"0123456789abcdef".repeat(8)}`;
  hash(plain: string): Promise<string> { return hashPassword(plain); }
  verify(plain: string, hash: string): Promise<boolean> { return verifyPassword(plain, hash); }
}
