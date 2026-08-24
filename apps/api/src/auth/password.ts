import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { createGate } from "../lib/concurrency-gate.js";

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

/** scrypt runs on the libuv threadpool, which holds four threads and is shared
 * with Prisma's engine and every filesystem call. `login` spends a hash on
 * every anonymous request by design, so without a cap a modest burst — spread
 * across enough addresses to slip past the per-address limiter — occupies the
 * whole pool and stalls work that has nothing to do with signing in.
 *
 * Two, not four: the instance has half a vCPU, so four concurrent hashes would
 * not finish faster, they would merely finish together and leave nothing for
 * anyone else. Raising UV_THREADPOOL_SIZE was considered and rejected — more
 * threads than CPU share buys context switching, not capacity. */
export const scryptGate = createGate({
  maxConcurrent: 2,
  maxQueue: 20,
  maxWaitMs: 5000,
});

/** Returns `salt:key`, both hex. The salt is stored alongside the key on
 * purpose: it is not a secret, and verification cannot work without it. */
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
