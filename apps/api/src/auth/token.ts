import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { config } from "../config.js";

const secret = new TextEncoder().encode(config.jwtSecret);

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface AccessTokenClaims {
  sub: string;
  name: string;
  email: string;
}

export async function signAccessToken(claims: AccessTokenClaims): Promise<string> {
  return new SignJWT({ name: claims.name, email: claims.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_TTL)
    .sign(secret);
}

/** Rejects an expired, tampered or malformed token — `jose` throws for all
 * three, and the caller treats every rejection the same way. */
export async function verifyAccessToken(token: string): Promise<AccessTokenClaims> {
  const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
  const { sub, name, email } = payload as { sub?: string; name?: string; email?: string };
  if (!sub || !name || !email) throw new Error("Access token is missing its claims");
  return { sub, name, email };
}

/** An opaque 256-bit value. Nothing is signed: the server looks it up in the
 * database on every use, so a signature would not add a check. */
export function generateRefreshToken(): string {
  return randomBytes(32).toString("hex");
}

/** A plain digest is enough here, unlike for passwords: the token already
 * carries full entropy, so there is nothing to guess and nothing to slow down. */
export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function refreshTokenExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + REFRESH_TOKEN_TTL_MS);
}
