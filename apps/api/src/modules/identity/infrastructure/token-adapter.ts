import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { config } from "../../../shared/infrastructure/config.js";
import type { SessionPrincipal } from "../domain/identity-user.js";
import type { TokenPort } from "../application/ports.js";

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * The only place tokens are minted and read. Access tokens are short-lived JWTs
 * carrying the principal; refresh tokens are opaque values the server looks up,
 * so nothing is signed there — a signature would add no check the lookup does
 * not already make.
 */
export class TokenAdapter implements TokenPort {
  private readonly secret = new TextEncoder().encode(config.jwtSecret);

  async issueAccess(principal: SessionPrincipal): Promise<string> {
    return new SignJWT({ name: principal.name, email: principal.email })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(principal.id)
      .setIssuedAt()
      .setExpirationTime(ACCESS_TOKEN_TTL)
      .sign(this.secret);
  }

  /** Expired, tampered and malformed all throw, and the use case turns every
   * one of them into the same refusal. */
  async verifyAccess(token: string): Promise<SessionPrincipal> {
    const { payload } = await jwtVerify(token, this.secret, { algorithms: ["HS256"] });
    const { sub, name, email } = payload as { sub?: string; name?: string; email?: string };
    if (!sub || !name || !email) throw new Error("Access token is missing its claims");
    return { id: sub, name, email };
  }

  generateRefresh(): string {
    return randomBytes(32).toString("hex");
  }

  /** A plain digest is enough here, unlike for passwords: the token already
   * carries full entropy, so there is nothing to guess and nothing to slow down. */
  hashRefresh(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  refreshExpiry(now: Date = new Date()): Date {
    return new Date(now.getTime() + REFRESH_TOKEN_TTL_MS);
  }
}
