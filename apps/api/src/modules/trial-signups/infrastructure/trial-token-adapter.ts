import { createHash, randomBytes } from "node:crypto";
import type { TrialTokens } from "../application/ports.js";

const TRIAL_LINK_TTL_MS = 24 * 60 * 60 * 1000;

export class TrialTokenAdapter implements TrialTokens {
  generate(): string {
    return randomBytes(32).toString("hex");
  }

  hash(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  expiry(now: Date): Date {
    return new Date(now.getTime() + TRIAL_LINK_TTL_MS);
  }
}
