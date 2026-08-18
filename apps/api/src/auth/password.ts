import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number },
) => Promise<Buffer>;

const SALT_BYTES = 16;
const KEY_BYTES = 64;
/** 128 * N * r = 16 MB, comfortably inside Node's 32 MB default for scrypt. */
const PARAMS = { N: 16384, r: 8, p: 1 };

/** Returns `salt:key`, both hex. The salt is stored alongside the key on
 * purpose: it is not a secret, and verification cannot work without it. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await scryptAsync(password, salt, KEY_BYTES, PARAMS);
  return `${salt.toString("hex")}:${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, keyHex] = stored.split(":");
  if (!saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, "hex");
  if (expected.length !== KEY_BYTES) return false;
  const key = await scryptAsync(password, Buffer.from(saltHex, "hex"), KEY_BYTES, PARAMS);
  return timingSafeEqual(expected, key);
}
