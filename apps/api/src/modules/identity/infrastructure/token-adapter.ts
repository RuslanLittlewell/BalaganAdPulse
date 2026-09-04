import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { config } from "../../../shared/infrastructure/config.js";
import type { SessionPrincipal } from "../domain/identity-user.js";
import type { TokenPort } from "../application/ports.js";

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

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

  async verifyAccess(token: string): Promise<SessionPrincipal> {
    const { payload } = await jwtVerify(token, this.secret, { algorithms: ["HS256"] });
    const { sub, name, email } = payload as { sub?: string; name?: string; email?: string };
    if (!sub || !name || !email) throw new Error("Access token is missing its claims");
    return { id: sub, name, email };
  }

  generateRefresh(): string {
    return randomBytes(32).toString("hex");
  }

  hashRefresh(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  refreshExpiry(now: Date = new Date()): Date {
    return new Date(now.getTime() + REFRESH_TOKEN_TTL_MS);
  }
}
