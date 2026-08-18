export interface Config {
  jwtSecret: string;
  inviteCode: string;
}

/** The values shipped in `apps/api/.env.example`. The documented setup copies
 * that file, so a deployment that never edited it would sign tokens with a key
 * published in this repository — and `requireAuth` does no database lookup, so
 * anyone holding that key can mint a token for an arbitrary user. */
const PLACEHOLDER_JWT_SECRET = "dev-secret-change-me";
const PLACEHOLDER_INVITE_CODE = "adpulse-invite";

/** 256 bits, matching the HS256 output the secret keys. */
const MIN_JWT_SECRET_LENGTH = 32;

/** Reads the settings the API cannot run without. Exported separately from
 * `config` so it can be tested without touching the real environment.
 *
 * The extra checks apply only in production: local development keeps working
 * with the placeholders straight out of `.env.example`. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const jwtSecret = env.JWT_SECRET;
  const inviteCode = env.INVITE_CODE;
  if (!jwtSecret) throw new Error("JWT_SECRET is required but not set");
  if (!inviteCode) throw new Error("INVITE_CODE is required but not set");

  if (env.NODE_ENV === "production") {
    if (jwtSecret === PLACEHOLDER_JWT_SECRET) {
      throw new Error(
        "JWT_SECRET still holds the placeholder from .env.example; set a real secret before deploying",
      );
    }
    if (jwtSecret.length < MIN_JWT_SECRET_LENGTH) {
      throw new Error(`JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters long`);
    }
    if (inviteCode === PLACEHOLDER_INVITE_CODE) {
      throw new Error(
        "INVITE_CODE still holds the placeholder from .env.example; set a real code before deploying",
      );
    }
  }

  return { jwtSecret, inviteCode };
}

/** Evaluated at import time: a server that starts with an empty signing secret
 * issues tokens anyone can forge, so failing loudly here is the point. */
export const config = loadConfig();
