# Authentication Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the API behind sign-in and make every client, campaign, property, record and value reachable only by the user who owns it.

**Architecture:** A `User` owns `Client`, and ownership reaches everything else through existing foreign keys. Sign-in issues a short-lived HS256 access token plus an opaque refresh token stored hashed in Postgres. A `requireAuth` middleware mounted at `/api` puts the caller's id on the request, and every service entry point takes that id as its first argument and filters its entry query through a fragment from `auth/scope.ts`.

**Tech Stack:** TypeScript, Express 5, Prisma 6, PostgreSQL, Zod 4, `jose` for JWT, `node:crypto` for password hashing, Vitest + Supertest.

**Spec:** [docs/superpowers/specs/2026-08-13-adpulse-auth-design.md](../specs/2026-08-13-adpulse-auth-design.md)

## Global Constraints

- **English only** — code, comments, docs, commit messages, API error messages.
- **Conventional Commits** — `type(scope): subject`, imperative, lowercase, no trailing period.
- **TDD** — the failing test is written and observed failing before the implementation.
- Layering stays routes → controller (Zod) → service (Prisma) → PostgreSQL.
- Error envelope stays `{ "error": { "message": string, "details"?: unknown } }`.
- Access token lifetime is exactly 15 minutes; refresh token lifetime is exactly 30 days.
- Refresh tokens are **not** rotated: `/api/auth/refresh` returns only a new access token.
- A resource belonging to another user answers **404**, never 403.
- Password hashing is `scrypt` from `node:crypto` with `N=16384, r=8, p=1`, a 16-byte salt and a 64-byte key, stored as `salt:hash` in hex.
- The only new runtime dependency permitted by this plan is `jose`.
- Run tests from the repository root with `npm test`. Postgres must be up: `npm run db:up`.

---

### Task 1: Configuration module

**Files:**
- Create: `apps/api/src/config.ts`
- Create: `apps/api/test/config.test.ts`
- Modify: `apps/api/.env`, `apps/api/.env.test`, `apps/api/.env.example`

**Interfaces:**
- Consumes: nothing.
- Produces: `loadConfig(env?: NodeJS.ProcessEnv): Config` and the eagerly-loaded `config: Config`, where `Config = { jwtSecret: string; inviteCode: string }`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/test/config.test.ts
import { describe, it, expect } from "vitest";
import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  it("reads both required variables", () => {
    const config = loadConfig({ JWT_SECRET: "s", INVITE_CODE: "c" });
    expect(config).toEqual({ jwtSecret: "s", inviteCode: "c" });
  });

  it("throws when JWT_SECRET is missing", () => {
    expect(() => loadConfig({ INVITE_CODE: "c" })).toThrow(/JWT_SECRET/);
  });

  it("throws when INVITE_CODE is missing", () => {
    expect(() => loadConfig({ JWT_SECRET: "s" })).toThrow(/INVITE_CODE/);
  });

  it("treats an empty value as missing", () => {
    expect(() => loadConfig({ JWT_SECRET: "", INVITE_CODE: "c" })).toThrow(/JWT_SECRET/);
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npm test -w @adpulse/api -- config`
Expected: FAIL — `Cannot find module '../src/config.js'`.

- [ ] **Step 3: Write the implementation**

```ts
// apps/api/src/config.ts
export interface Config {
  jwtSecret: string;
  inviteCode: string;
}

/** Reads the settings the API cannot run without. Exported separately from
 * `config` so it can be tested without touching the real environment. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const jwtSecret = env.JWT_SECRET;
  const inviteCode = env.INVITE_CODE;
  if (!jwtSecret) throw new Error("JWT_SECRET is required but not set");
  if (!inviteCode) throw new Error("INVITE_CODE is required but not set");
  return { jwtSecret, inviteCode };
}

/** Evaluated at import time: a server that starts with an empty signing secret
 * issues tokens anyone can forge, so failing loudly here is the point. */
export const config = loadConfig();
```

- [ ] **Step 4: Add the variables to all three env files**

Append to `apps/api/.env`, `apps/api/.env.test` and `apps/api/.env.example` (invent any local values for `.env` and `.env.test`; `.env.example` documents them):

```
JWT_SECRET=dev-secret-change-me
INVITE_CODE=adpulse-invite
```

`.env.test` is loaded by both `test/setup.ts` and `test/global-setup.ts`, which is how the test suite gets them.

- [ ] **Step 5: Run the test and watch it pass**

Run: `npm test -w @adpulse/api -- config`
Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/config.ts apps/api/test/config.test.ts apps/api/.env.example
git commit -m "feat(config): require jwt secret and invite code at startup"
```

`.env` and `.env.test` are not committed if they are ignored; check `git status` and add them only if the repository already tracks them.

---

### Task 2: Password hashing

**Files:**
- Create: `apps/api/src/auth/password.ts`
- Create: `apps/api/test/auth/password.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `hashPassword(password: string): Promise<string>` and `verifyPassword(password: string, stored: string): Promise<boolean>`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/test/auth/password.test.ts
import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "../../src/auth/password.js";

describe("password hashing", () => {
  it("produces a different hash for the same password each time", async () => {
    const first = await hashPassword("correct horse");
    const second = await hashPassword("correct horse");
    expect(first).not.toBe(second);
  });

  it("stores the salt and the key separated by a colon", async () => {
    const stored = await hashPassword("correct horse");
    const [salt, key] = stored.split(":");
    expect(salt).toMatch(/^[0-9a-f]{32}$/);
    expect(key).toMatch(/^[0-9a-f]{128}$/);
  });

  it("accepts the right password", async () => {
    const stored = await hashPassword("correct horse");
    expect(await verifyPassword("correct horse", stored)).toBe(true);
  });

  it("rejects the wrong password", async () => {
    const stored = await hashPassword("correct horse");
    expect(await verifyPassword("wrong horse", stored)).toBe(false);
  });

  it("rejects a malformed stored value instead of throwing", async () => {
    expect(await verifyPassword("correct horse", "not-a-hash")).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npm test -w @adpulse/api -- password`
Expected: FAIL — `Cannot find module '../../src/auth/password.js'`.

- [ ] **Step 3: Write the implementation**

```ts
// apps/api/src/auth/password.ts
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
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npm test -w @adpulse/api -- password`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/auth/password.ts apps/api/test/auth/password.test.ts
git commit -m "feat(auth): hash passwords with scrypt"
```

---

### Task 3: Token helpers

**Files:**
- Create: `apps/api/src/auth/token.ts`
- Create: `apps/api/test/auth/token.test.ts`
- Modify: `apps/api/package.json` (add `jose`)

**Interfaces:**
- Consumes: `config` from Task 1.
- Produces: `signAccessToken(claims: AccessTokenClaims): Promise<string>`, `verifyAccessToken(token: string): Promise<AccessTokenClaims>`, `generateRefreshToken(): string`, `hashRefreshToken(token: string): string`, `refreshTokenExpiry(now?: Date): Date`, and `AccessTokenClaims = { sub: string; name: string; email: string }`.

- [ ] **Step 1: Install the dependency**

Run: `npm install jose -w @adpulse/api`

- [ ] **Step 2: Write the failing test**

```ts
// apps/api/test/auth/token.test.ts
import { describe, it, expect } from "vitest";
import {
  signAccessToken, verifyAccessToken, generateRefreshToken,
  hashRefreshToken, refreshTokenExpiry,
} from "../../src/auth/token.js";

const claims = { sub: "user-1", name: "Buyer", email: "buyer@acme.com" };

describe("access tokens", () => {
  it("round-trips its claims", async () => {
    const token = await signAccessToken(claims);
    expect(await verifyAccessToken(token)).toMatchObject(claims);
  });

  it("expires 15 minutes after it is issued", async () => {
    const token = await signAccessToken(claims);
    const [, payload] = token.split(".");
    const { iat, exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    expect(exp - iat).toBe(15 * 60);
  });

  it("rejects a tampered token", async () => {
    const token = await signAccessToken(claims);
    await expect(verifyAccessToken(`${token}x`)).rejects.toThrow();
  });

  it("rejects a token that is not a token at all", async () => {
    await expect(verifyAccessToken("nonsense")).rejects.toThrow();
  });
});

describe("refresh tokens", () => {
  it("generates 32 bytes of hex", () => {
    expect(generateRefreshToken()).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generates a different token each time", () => {
    expect(generateRefreshToken()).not.toBe(generateRefreshToken());
  });

  it("hashes deterministically and does not return the token itself", () => {
    const token = generateRefreshToken();
    expect(hashRefreshToken(token)).toBe(hashRefreshToken(token));
    expect(hashRefreshToken(token)).not.toBe(token);
  });

  it("expires 30 days after the given moment", () => {
    const now = new Date("2026-08-13T00:00:00.000Z");
    expect(refreshTokenExpiry(now).toISOString()).toBe("2026-09-12T00:00:00.000Z");
  });
});
```

- [ ] **Step 3: Run the test and watch it fail**

Run: `npm test -w @adpulse/api -- token`
Expected: FAIL — `Cannot find module '../../src/auth/token.js'`.

- [ ] **Step 4: Write the implementation**

```ts
// apps/api/src/auth/token.ts
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
```

- [ ] **Step 5: Run the test and watch it pass**

Run: `npm test -w @adpulse/api -- token`
Expected: PASS, 8 tests.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/auth/token.ts apps/api/test/auth/token.test.ts apps/api/package.json package-lock.json
git commit -m "feat(auth): sign access tokens and mint refresh tokens"
```

---

### Task 4: User and RefreshToken models

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_add_users/migration.sql` (generated)
- Modify: `apps/api/test/helpers/db.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: Prisma models `User` and `RefreshToken`; `resetDb()` now also clears both.

This task is purely additive — `Client` is untouched, so the whole suite stays green.

- [ ] **Step 1: Add the models to the schema**

Append to `apps/api/prisma/schema.prisma`:

```prisma
model User {
  id            String         @id @default(uuid())
  email         String         @unique
  name          String
  passwordHash  String         @map("password_hash")
  createdAt     DateTime       @default(now()) @map("created_at")
  refreshTokens RefreshToken[]

  @@map("app_user")
}

model RefreshToken {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash String   @unique @map("token_hash")
  expiresAt DateTime @map("expires_at")
  createdAt DateTime @default(now()) @map("created_at")

  @@index([userId])
  @@map("refresh_token")
}
```

The table is `app_user` rather than `user` because `USER` is reserved in PostgreSQL.

- [ ] **Step 2: Generate and apply the migration**

Run: `npm run prisma:migrate -w @adpulse/api -- --name add_users`
Expected: a new folder under `apps/api/prisma/migrations/` and "Your database is now in sync with your schema".

- [ ] **Step 3: Extend `resetDb`**

```ts
// apps/api/test/helpers/db.ts
import { prisma } from "../../src/lib/prisma.js";

export async function resetDb(): Promise<void> {
  await prisma.campaignPropertyValue.deleteMany();
  await prisma.campaignRecord.deleteMany();
  await prisma.campaignProperty.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.client.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
}
```

- [ ] **Step 4: Run the whole suite and watch it stay green**

Run: `npm test`
Expected: PASS — the same tests as before, now against a schema that also has `app_user` and `refresh_token`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma apps/api/test/helpers/db.ts
git commit -m "feat(auth): add user and refresh token models"
```

---

### Task 5: Auth schemas and service

**Files:**
- Create: `apps/api/src/auth/auth.schema.ts`
- Create: `apps/api/src/auth/auth.service.ts`
- Modify: `apps/api/src/errors.ts`
- Create: `apps/api/test/auth/auth.service.test.ts`
- Create: `apps/api/test/auth/auth.schema.test.ts`

**Interfaces:**
- Consumes: `hashPassword`/`verifyPassword` (Task 2); `signAccessToken`, `generateRefreshToken`, `hashRefreshToken`, `refreshTokenExpiry` (Task 3); `config` (Task 1).
- Produces: `registerSchema`, `loginSchema`, `refreshSchema`, `logoutSchema`; `register(input: RegisterInput): Promise<TokenPair>`, `login(input: LoginInput): Promise<TokenPair>`, `refresh(token: string): Promise<{ accessToken: string }>`, `logout(token: string): Promise<void>`, `TokenPair = { accessToken: string; refreshToken: string }`; error classes `UnauthorizedError` and `ForbiddenError`.

- [ ] **Step 1: Write the failing schema test**

```ts
// apps/api/test/auth/auth.schema.test.ts
import { describe, it, expect } from "vitest";
import { registerSchema, loginSchema } from "../../src/auth/auth.schema.js";

describe("registerSchema", () => {
  const valid = {
    name: "Buyer", email: "Buyer@Acme.com", password: "hunter2hunter2", inviteCode: "c",
  };

  it("lowercases and trims the email", () => {
    expect(registerSchema.parse({ ...valid, email: "  Buyer@Acme.com " }).email)
      .toBe("buyer@acme.com");
  });

  it("trims the name", () => {
    expect(registerSchema.parse({ ...valid, name: "  Buyer  " }).name).toBe("Buyer");
  });

  it("rejects a password shorter than 8 characters", () => {
    expect(() => registerSchema.parse({ ...valid, password: "short" })).toThrow();
  });

  it("rejects an address without a dotted domain", () => {
    expect(() => registerSchema.parse({ ...valid, email: "buyer@acme" })).toThrow();
  });

  it("rejects a missing invite code", () => {
    expect(() => registerSchema.parse({ ...valid, inviteCode: "" })).toThrow();
  });
});

describe("loginSchema", () => {
  it("lowercases the email", () => {
    expect(loginSchema.parse({ email: "Buyer@Acme.com", password: "x" }).email)
      .toBe("buyer@acme.com");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test -w @adpulse/api -- auth.schema`
Expected: FAIL — `Cannot find module '../../src/auth/auth.schema.js'`.

- [ ] **Step 3: Write the schemas**

```ts
// apps/api/src/auth/auth.schema.ts
import { z } from "zod";

/** Normalize before validating, so `Buyer@Acme.com ` and `buyer@acme.com`
 * cannot both satisfy the unique constraint as two separate accounts. */
const email = z.string().trim().toLowerCase().pipe(z.email("invalid email"));

export const registerSchema = z.object({
  name: z.string().trim().min(1, "name is required"),
  email,
  password: z.string().min(8, "password must be at least 8 characters"),
  inviteCode: z.string().min(1, "inviteCode is required"),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "password is required"),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, "refreshToken is required"),
});

export const logoutSchema = refreshSchema;

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
```

- [ ] **Step 4: Run the schema test and watch it pass**

Run: `npm test -w @adpulse/api -- auth.schema`
Expected: PASS, 6 tests.

- [ ] **Step 5: Add the two error classes**

Append to `apps/api/src/errors.ts`:

```ts
export class UnauthorizedError extends Error {
  status = 401;
  constructor(message = "Authentication required") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  status = 403;
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}
```

- [ ] **Step 6: Write the failing service test**

```ts
// apps/api/test/auth/auth.service.test.ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "../../src/lib/prisma.js";
import { resetDb } from "../helpers/db.js";
import { register, login, refresh, logout } from "../../src/auth/auth.service.js";
import { hashRefreshToken } from "../../src/auth/token.js";
import { config } from "../../src/config.js";

const input = {
  name: "Buyer", email: "buyer@acme.com", password: "hunter2hunter2",
  inviteCode: config.inviteCode,
};

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await prisma.$disconnect(); });

describe("register", () => {
  it("creates the user and returns both tokens", async () => {
    const pair = await register(input);
    expect(pair.accessToken).toMatch(/\./);
    expect(pair.refreshToken).toMatch(/^[0-9a-f]{64}$/);
    expect(await prisma.user.count()).toBe(1);
  });

  it("never stores the password itself", async () => {
    await register(input);
    const user = await prisma.user.findFirstOrThrow();
    expect(user.passwordHash).not.toContain("hunter2hunter2");
  });

  it("stores the refresh token hashed", async () => {
    const pair = await register(input);
    const row = await prisma.refreshToken.findFirstOrThrow();
    expect(row.tokenHash).toBe(hashRefreshToken(pair.refreshToken));
    expect(row.tokenHash).not.toBe(pair.refreshToken);
  });

  it("rejects a wrong invite code with 403", async () => {
    await expect(register({ ...input, inviteCode: "nope" }))
      .rejects.toMatchObject({ status: 403 });
  });

  it("rejects a duplicate email with 409", async () => {
    await register(input);
    await expect(register(input)).rejects.toMatchObject({ status: 409 });
  });
});

describe("login", () => {
  it("returns a fresh pair for the right password", async () => {
    await register(input);
    const pair = await login({ email: input.email, password: input.password });
    expect(pair.refreshToken).toMatch(/^[0-9a-f]{64}$/);
    expect(await prisma.refreshToken.count()).toBe(2);
  });

  it("rejects a wrong password with 401", async () => {
    await register(input);
    await expect(login({ email: input.email, password: "wrongwrongwrong" }))
      .rejects.toMatchObject({ status: 401, message: "Invalid email or password" });
  });

  it("gives an unknown email the identical answer", async () => {
    await expect(login({ email: "nobody@acme.com", password: "hunter2hunter2" }))
      .rejects.toMatchObject({ status: 401, message: "Invalid email or password" });
  });

  it("deletes the user's expired refresh rows", async () => {
    const { refreshToken } = await register(input);
    const user = await prisma.user.findFirstOrThrow();
    await prisma.refreshToken.create({
      data: {
        userId: user.id, tokenHash: "stale-hash",
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    await login({ email: input.email, password: input.password });
    const hashes = (await prisma.refreshToken.findMany()).map((row) => row.tokenHash);
    expect(hashes).not.toContain("stale-hash");
    expect(hashes).toContain(hashRefreshToken(refreshToken));
  });
});

describe("refresh", () => {
  it("issues a new access token and leaves the refresh token in place", async () => {
    const pair = await register(input);
    const { accessToken } = await refresh(pair.refreshToken);
    expect(accessToken).toMatch(/\./);
    expect(await prisma.refreshToken.count()).toBe(1);
  });

  it("accepts the same refresh token twice — tokens are not rotated", async () => {
    const pair = await register(input);
    await refresh(pair.refreshToken);
    await expect(refresh(pair.refreshToken)).resolves.toHaveProperty("accessToken");
  });

  it("rejects an unknown token with 401", async () => {
    await expect(refresh("f".repeat(64))).rejects.toMatchObject({ status: 401 });
  });

  it("rejects an expired token with 401", async () => {
    await register(input);
    await prisma.refreshToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    const row = await prisma.refreshToken.findFirstOrThrow();
    expect(row.expiresAt.getTime()).toBeLessThan(Date.now());
    await expect(refresh("f".repeat(64))).rejects.toMatchObject({ status: 401 });
  });
});

describe("logout", () => {
  it("deletes the row so the token stops working", async () => {
    const pair = await register(input);
    await logout(pair.refreshToken);
    expect(await prisma.refreshToken.count()).toBe(0);
    await expect(refresh(pair.refreshToken)).rejects.toMatchObject({ status: 401 });
  });

  it("is silent about a token that is already gone", async () => {
    await expect(logout("f".repeat(64))).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 7: Run it and watch it fail**

Run: `npm test -w @adpulse/api -- auth.service`
Expected: FAIL — `Cannot find module '../../src/auth/auth.service.js'`.

- [ ] **Step 8: Write the service**

```ts
// apps/api/src/auth/auth.service.ts
import type { User } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { config } from "../config.js";
import { ConflictError, ForbiddenError, UnauthorizedError } from "../errors.js";
import { hashPassword, verifyPassword } from "./password.js";
import {
  generateRefreshToken, hashRefreshToken, refreshTokenExpiry, signAccessToken,
} from "./token.js";
import type { LoginInput, RegisterInput } from "./auth.schema.js";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

async function issueTokens(user: User): Promise<TokenPair> {
  const accessToken = await signAccessToken({
    sub: user.id, name: user.name, email: user.email,
  });
  const refreshToken = generateRefreshToken();
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: refreshTokenExpiry(),
    },
  });
  return { accessToken, refreshToken };
}

export async function register(input: RegisterInput): Promise<TokenPair> {
  if (input.inviteCode !== config.inviteCode) {
    throw new ForbiddenError("Invalid invite code");
  }
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new ConflictError("This email is already registered");

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
    },
  });
  return issueTokens(user);
}

export async function login(input: LoginInput): Promise<TokenPair> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  // One answer for both failures, so the form cannot be used to find out
  // which addresses have accounts.
  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    throw new UnauthorizedError("Invalid email or password");
  }
  await prisma.refreshToken.deleteMany({
    where: { userId: user.id, expiresAt: { lt: new Date() } },
  });
  return issueTokens(user);
}

export async function refresh(token: string): Promise<{ accessToken: string }> {
  const row = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashRefreshToken(token) },
    include: { user: true },
  });
  if (!row || row.expiresAt <= new Date()) throw new UnauthorizedError("Session expired");
  const accessToken = await signAccessToken({
    sub: row.user.id, name: row.user.name, email: row.user.email,
  });
  return { accessToken };
}

/** `deleteMany` rather than `delete`: a token that is already gone satisfies
 * the caller's goal, so it is not an error. */
export async function logout(token: string): Promise<void> {
  await prisma.refreshToken.deleteMany({ where: { tokenHash: hashRefreshToken(token) } });
}
```

- [ ] **Step 9: Run the service test and watch it pass**

Run: `npm test -w @adpulse/api -- auth.service`
Expected: PASS, 14 tests.

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/auth apps/api/src/errors.ts apps/api/test/auth
git commit -m "feat(auth): add register, login, refresh and logout services"
```

---

### Task 6: Auth routes

**Files:**
- Create: `apps/api/src/auth/auth.controller.ts`
- Create: `apps/api/src/auth/auth.routes.ts`
- Modify: `apps/api/src/app.ts`
- Create: `apps/api/test/auth/auth.api.test.ts`

**Interfaces:**
- Consumes: the schemas and services from Task 5.
- Produces: `authRouter`, mounted at `/api/auth`.

- [ ] **Step 1: Write the failing API test**

```ts
// apps/api/test/auth/auth.api.test.ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { resetDb } from "../helpers/db.js";
import { config } from "../../src/config.js";

const app = createApp();
const body = {
  name: "Buyer", email: "buyer@acme.com", password: "hunter2hunter2",
  inviteCode: config.inviteCode,
};

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await prisma.$disconnect(); });

describe("Auth API", () => {
  it("POST /api/auth/register creates an account (201)", async () => {
    const res = await request(app).post("/api/auth/register").send(body);
    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
  });

  it("POST /api/auth/register with a wrong code -> 403", async () => {
    const res = await request(app).post("/api/auth/register")
      .send({ ...body, inviteCode: "nope" });
    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe("Invalid invite code");
  });

  it("POST /api/auth/register with a short password -> 400", async () => {
    const res = await request(app).post("/api/auth/register")
      .send({ ...body, password: "short" });
    expect(res.status).toBe(400);
  });

  it("POST /api/auth/register twice -> 409", async () => {
    await request(app).post("/api/auth/register").send(body);
    const res = await request(app).post("/api/auth/register").send(body);
    expect(res.status).toBe(409);
  });

  it("POST /api/auth/login returns a pair (200)", async () => {
    await request(app).post("/api/auth/register").send(body);
    const res = await request(app).post("/api/auth/login")
      .send({ email: body.email, password: body.password });
    expect(res.status).toBe(200);
    expect(res.body.refreshToken).toBeTruthy();
  });

  it("POST /api/auth/login with a wrong password -> 401", async () => {
    await request(app).post("/api/auth/register").send(body);
    const res = await request(app).post("/api/auth/login")
      .send({ email: body.email, password: "wrongwrongwrong" });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe("Invalid email or password");
  });

  it("POST /api/auth/refresh returns only an access token (200)", async () => {
    const created = await request(app).post("/api/auth/register").send(body);
    const res = await request(app).post("/api/auth/refresh")
      .send({ refreshToken: created.body.refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeUndefined();
  });

  it("POST /api/auth/refresh with an unknown token -> 401", async () => {
    const res = await request(app).post("/api/auth/refresh")
      .send({ refreshToken: "f".repeat(64) });
    expect(res.status).toBe(401);
  });

  it("POST /api/auth/logout revokes the token (204)", async () => {
    const created = await request(app).post("/api/auth/register").send(body);
    const res = await request(app).post("/api/auth/logout")
      .send({ refreshToken: created.body.refreshToken });
    expect(res.status).toBe(204);

    const after = await request(app).post("/api/auth/refresh")
      .send({ refreshToken: created.body.refreshToken });
    expect(after.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test -w @adpulse/api -- auth.api`
Expected: FAIL — every request answers 404, because nothing is mounted at `/api/auth`.

- [ ] **Step 3: Write the controller**

```ts
// apps/api/src/auth/auth.controller.ts
import type { NextFunction, Request, Response } from "express";
import {
  loginSchema, logoutSchema, refreshSchema, registerSchema,
} from "./auth.schema.js";
import * as service from "./auth.service.js";

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const data = registerSchema.parse(req.body);
    res.status(201).json(await service.register(data));
  } catch (e) { next(e); }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const data = loginSchema.parse(req.body);
    res.json(await service.login(data));
  } catch (e) { next(e); }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const data = refreshSchema.parse(req.body);
    res.json(await service.refresh(data.refreshToken));
  } catch (e) { next(e); }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const data = logoutSchema.parse(req.body);
    await service.logout(data.refreshToken);
    res.status(204).send();
  } catch (e) { next(e); }
}
```

- [ ] **Step 4: Write the router**

```ts
// apps/api/src/auth/auth.routes.ts
import { Router } from "express";
import * as controller from "./auth.controller.js";

/** Mounted at /api/auth, ahead of requireAuth — these are the only open routes. */
export const authRouter = Router();
authRouter.post("/register", controller.register);
authRouter.post("/login", controller.login);
authRouter.post("/refresh", controller.refresh);
authRouter.post("/logout", controller.logout);
```

- [ ] **Step 5: Mount it**

In `apps/api/src/app.ts`, add the import and mount `authRouter` as the first route, directly after `app.use(express.json())`:

```ts
import { authRouter } from "./auth/auth.routes.js";
// ...
app.use("/api/auth", authRouter);
```

- [ ] **Step 6: Run the test and watch it pass**

Run: `npm test -w @adpulse/api -- auth.api`
Expected: PASS, 9 tests.

- [ ] **Step 7: Run the whole suite**

Run: `npm test`
Expected: PASS — nothing is guarded yet, so the existing tests are unaffected.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/auth apps/api/src/app.ts apps/api/test/auth/auth.api.test.ts
git commit -m "feat(auth): expose register, login, refresh and logout endpoints"
```

---

### Task 7: Close the API behind requireAuth

**Files:**
- Create: `apps/api/src/middleware/require-auth.ts`
- Create: `apps/api/src/auth/current-user.ts`
- Create: `apps/api/src/types/express.d.ts`
- Create: `apps/api/test/helpers/auth.ts`
- Create: `apps/api/test/middleware/require-auth.test.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/test/clients/client.api.test.ts`, `apps/api/test/campaigns/campaign.api.test.ts`, `apps/api/test/properties/property.api.test.ts`, `apps/api/test/records/record.api.test.ts`, `apps/api/test/records/value.api.test.ts`

**Interfaces:**
- Consumes: `verifyAccessToken` (Task 3), `UnauthorizedError` (Task 5).
- Produces: `requireAuth` middleware; `userId(req: Request): string`; `Express.Request.user?: { id: string }`; test helper `signInAs(name?: string): Promise<{ user: User; auth: { Authorization: string } }>`.

This task closes every data route at once, so the existing API tests must be updated in the same commit — otherwise the suite is red between tasks. Services are not touched here; ownership arrives in Tasks 8–11.

- [ ] **Step 1: Write the failing middleware test**

```ts
// apps/api/test/middleware/require-auth.test.ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { resetDb } from "../helpers/db.js";
import { signInAs } from "../helpers/auth.js";

const app = createApp();

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await prisma.$disconnect(); });

describe("requireAuth", () => {
  it("rejects a request with no Authorization header -> 401", async () => {
    const res = await request(app).get("/api/clients");
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe("Authentication required");
  });

  it("rejects a header that is not a Bearer token -> 401", async () => {
    const res = await request(app).get("/api/clients").set({ Authorization: "Basic abc" });
    expect(res.status).toBe(401);
  });

  it("rejects a tampered token -> 401", async () => {
    const { auth } = await signInAs();
    const res = await request(app).get("/api/clients")
      .set({ Authorization: `${auth.Authorization}x` });
    expect(res.status).toBe(401);
  });

  it("admits a valid token -> 200", async () => {
    const { auth } = await signInAs();
    const res = await request(app).get("/api/clients").set(auth);
    expect(res.status).toBe(200);
  });

  it("leaves the auth routes open", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "x", password: "y" });
    expect(res.status).not.toBe(401);
  });
});
```

The last assertion uses `not.toBe(401)` on purpose: an invalid email makes this a 400, and what is being proved is only that the route is reachable without a token.

- [ ] **Step 2: Write the test helper**

```ts
// apps/api/test/helpers/auth.ts
import type { User } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { prisma } from "../../src/lib/prisma.js";
import { signAccessToken } from "../../src/auth/token.js";

export interface SignedIn {
  user: User;
  auth: { Authorization: string };
}

/** Creates a user and signs a token for them directly, rather than going
 * through /api/auth/login. scrypt is deliberately slow, and hashing a password
 * in every beforeEach would add seconds of waiting to the suite. The stored
 * hash is a placeholder: nothing in these tests verifies a password. */
export async function signInAs(name = "Buyer"): Promise<SignedIn> {
  const user = await prisma.user.create({
    data: { name, email: `${randomUUID()}@example.com`, passwordHash: "placeholder" },
  });
  const token = await signAccessToken({ sub: user.id, name: user.name, email: user.email });
  return { user, auth: { Authorization: `Bearer ${token}` } };
}
```

- [ ] **Step 3: Run the middleware test and watch it fail**

Run: `npm test -w @adpulse/api -- require-auth`
Expected: FAIL — `GET /api/clients` answers 200 without a token.

- [ ] **Step 4: Declare `req.user`**

```ts
// apps/api/src/types/express.d.ts
declare global {
  namespace Express {
    interface Request {
      user?: { id: string };
    }
  }
}

export {};
```

- [ ] **Step 5: Write the middleware and the accessor**

```ts
// apps/api/src/middleware/require-auth.ts
import type { NextFunction, Request, Response } from "express";
import { UnauthorizedError } from "../errors.js";
import { verifyAccessToken } from "../auth/token.js";

const PREFIX = "Bearer ";

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.header("authorization");
  if (!header?.startsWith(PREFIX)) {
    next(new UnauthorizedError("Authentication required"));
    return;
  }
  try {
    const claims = await verifyAccessToken(header.slice(PREFIX.length));
    req.user = { id: claims.sub };
    next();
  } catch {
    // Expired, tampered and malformed all look the same from outside.
    next(new UnauthorizedError("Authentication required"));
  }
}
```

```ts
// apps/api/src/auth/current-user.ts
import type { Request } from "express";
import { UnauthorizedError } from "../errors.js";

/** The caller's id, narrowed to a plain string. `req.user` is optional in the
 * type because Express does not know about the middleware, but every route
 * that calls this sits behind requireAuth. */
export function userId(req: Request): string {
  if (!req.user) throw new UnauthorizedError("Authentication required");
  return req.user.id;
}
```

- [ ] **Step 6: Mount the guard**

`apps/api/src/app.ts` becomes:

```ts
import express from "express";
import { authRouter } from "./auth/auth.routes.js";
import { requireAuth } from "./middleware/require-auth.js";
import { clientRouter } from "./clients/client.routes.js";
import { campaignRouter, clientCampaignRouter } from "./campaigns/campaign.routes.js";
import { campaignPropertyRouter, propertyRouter } from "./properties/property.routes.js";
import { campaignRecordRouter, recordRouter } from "./records/record.routes.js";
import { errorHandler } from "./middleware/error-handler.js";

export function createApp() {
  const app = express();
  app.use(express.json());

  app.use("/api/auth", authRouter);
  // Everything below this line is closed, so a route added later is protected
  // by default rather than open until somebody remembers to guard it.
  app.use("/api", requireAuth);

  app.use("/api/clients/:clientId/campaigns", clientCampaignRouter);
  app.use("/api/clients", clientRouter);
  app.use("/api/campaigns/:campaignId/properties", campaignPropertyRouter);
  app.use("/api/campaigns/:campaignId/records", campaignRecordRouter);
  app.use("/api/campaigns", campaignRouter);
  app.use("/api/properties", propertyRouter);
  app.use("/api/records", recordRouter);
  app.use(errorHandler);
  return app;
}

export default createApp;
```

- [ ] **Step 7: Run the middleware test and watch it pass**

Run: `npm test -w @adpulse/api -- require-auth`
Expected: PASS, 5 tests.

- [ ] **Step 8: Run the whole suite and watch the existing API tests go red**

Run: `npm test`
Expected: FAIL — every request in the five existing API test files now answers 401. This is the expected intermediate state; Step 9 fixes it.

- [ ] **Step 9: Sign in inside each existing API test file**

In each of `test/clients/client.api.test.ts`, `test/campaigns/campaign.api.test.ts`, `test/properties/property.api.test.ts`, `test/records/record.api.test.ts` and `test/records/value.api.test.ts`:

1. Add the import: `import { signInAs } from "../helpers/auth.js";`
2. Add a module-level holder and fill it after the reset:

```ts
let auth: { Authorization: string };

beforeEach(async () => {
  await resetDb();
  ({ auth } = await signInAs());
});
```

3. Add `.set(auth)` to every `request(app)` chain, after the verb and before `.send(...)`:

```ts
const res = await request(app).post("/api/clients").set(auth).send({ name: "Acme" });
```

Work file by file and re-run that file after each one:

Run: `npm test -w @adpulse/api -- client.api`
Expected: PASS.

- [ ] **Step 10: Run the whole suite and watch it go green**

Run: `npm test`
Expected: PASS — all files, including the five updated ones.

- [ ] **Step 11: Commit**

```bash
git add apps/api/src apps/api/test
git commit -m "feat(auth): require a bearer token on every data route"
```

---

### Task 8: Clients belong to their owner

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_add_client_owner/migration.sql` (generated)
- Create: `apps/api/src/auth/scope.ts`
- Modify: `apps/api/src/clients/client.service.ts`, `apps/api/src/clients/client.controller.ts`
- Modify: `apps/api/test/clients/client.service.test.ts`, `apps/api/test/clients/client.api.test.ts`

**Interfaces:**
- Consumes: `userId` (Task 7), `signInAs` (Task 7).
- Produces: `ownedClient`, `ownedCampaign`, `ownedProperty`, `ownedRecord` in `auth/scope.ts`; every `client.service` function now takes `ownerId` first.

- [ ] **Step 1: Reset the development database**

The new column is `NOT NULL` and the migration carries no backfill, so any existing rows must go first.

Run: `cd apps/api && npx prisma migrate reset --force && cd ../..`
Expected: the database is dropped, recreated and migrated. Development data is gone by design.

- [ ] **Step 2: Add the owner to the schema**

In `apps/api/prisma/schema.prisma`, add to `model Client`:

```prisma
  ownerId       String     @map("owner_id")
  owner         User       @relation(fields: [ownerId], references: [id], onDelete: Cascade)

  @@index([ownerId, createdAt])
```

and to `model User`:

```prisma
  clients       Client[]
```

- [ ] **Step 3: Generate and apply the migration**

Run: `npm run prisma:migrate -w @adpulse/api -- --name add_client_owner`
Expected: the migration is created and applied.

- [ ] **Step 4: Write the scope fragments**

```ts
// apps/api/src/auth/scope.ts
/**
 * Ownership reaches every model through foreign keys from Client, so a filter
 * is only needed on the query that first fetches an entity by an id from
 * outside. These are the only place the chain is spelled out.
 */
export const ownedClient = (ownerId: string, id: string) => ({ id, ownerId });

export const ownedCampaign = (ownerId: string, id: string) =>
  ({ id, client: { ownerId } });

export const ownedProperty = (ownerId: string, id: string) =>
  ({ id, campaign: { client: { ownerId } } });

export const ownedRecord = (ownerId: string, id: string) =>
  ({ id, campaign: { client: { ownerId } } });
```

- [ ] **Step 5: Write the failing tests**

Add to `apps/api/test/clients/client.api.test.ts`:

```ts
it("GET /api/clients only lists the caller's clients", async () => {
  await request(app).post("/api/clients").set(auth).send({ name: "Mine" });
  const other = await signInAs("Other");
  await request(app).post("/api/clients").set(other.auth).send({ name: "Theirs" });

  const res = await request(app).get("/api/clients").set(auth);
  expect(res.status).toBe(200);
  expect(res.body.map((client: { name: string }) => client.name)).toEqual(["Mine"]);
});

it("GET /api/clients/:id for another user's client -> 404", async () => {
  const other = await signInAs("Other");
  const theirs = await request(app).post("/api/clients").set(other.auth).send({ name: "Theirs" });

  const res = await request(app).get(`/api/clients/${theirs.body.id}`).set(auth);
  expect(res.status).toBe(404);
});

it("DELETE /api/clients/:id for another user's client -> 404 and keeps it", async () => {
  const other = await signInAs("Other");
  const theirs = await request(app).post("/api/clients").set(other.auth).send({ name: "Theirs" });

  const res = await request(app).delete(`/api/clients/${theirs.body.id}`).set(auth);
  expect(res.status).toBe(404);
  expect(await prisma.client.count()).toBe(1);
});
```

- [ ] **Step 6: Run them and watch them fail**

Run: `npm test -w @adpulse/api -- client.api`
Expected: FAIL — creation fails because `ownerId` is required, and the isolation assertions do not hold.

- [ ] **Step 7: Rewrite the service**

```ts
// apps/api/src/clients/client.service.ts
import type { Client } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { NotFoundError } from "../errors.js";
import { ownedClient } from "../auth/scope.js";
import type { CreateClientInput, UpdateClientInput } from "./client.schema.js";
import { buildCampaignCreateData, DEFAULT_CAMPAIGN_NAME } from "../campaigns/defaults.js";

export async function createClient(
  ownerId: string,
  input: CreateClientInput,
): Promise<Client> {
  return prisma.client.create({
    data: {
      ...input,
      ownerId,
      campaigns: { create: buildCampaignCreateData(DEFAULT_CAMPAIGN_NAME, 0) },
    },
  });
}

export async function listClients(ownerId: string): Promise<Client[]> {
  return prisma.client.findMany({ where: { ownerId }, orderBy: { createdAt: "desc" } });
}

/** findFirst rather than findUnique: `where` on findUnique accepts only a
 * unique key, and the owner is not part of one. A foreign id and a missing id
 * both come back null, which is why both answer 404. */
export async function getClient(ownerId: string, id: string): Promise<Client> {
  const client = await prisma.client.findFirst({ where: ownedClient(ownerId, id) });
  if (!client) throw new NotFoundError("Client not found");
  return client;
}

export async function updateClient(
  ownerId: string,
  id: string,
  input: UpdateClientInput,
): Promise<Client> {
  await getClient(ownerId, id);
  return prisma.client.update({ where: { id }, data: input });
}

export async function deleteClient(ownerId: string, id: string): Promise<void> {
  await getClient(ownerId, id);
  await prisma.client.delete({ where: { id } });
}
```

- [ ] **Step 8: Pass the owner from the controller**

In `apps/api/src/clients/client.controller.ts`, import `userId` and thread it through each handler:

```ts
import { userId } from "../auth/current-user.js";
// ...
export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const data = createClientSchema.parse(req.body);
    res.status(201).json(await createClient(userId(req), data));
  } catch (e) { next(e); }
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await listClients(userId(req)));
  } catch (e) { next(e); }
}

export async function getOne(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    res.json(await getClient(userId(req), req.params.id));
  } catch (e) { next(e); }
}

export async function update(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    const data = updateClientSchema.parse(req.body);
    res.json(await updateClient(userId(req), req.params.id, data));
  } catch (e) { next(e); }
}

export async function remove(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  try {
    await deleteClient(userId(req), req.params.id);
    res.status(204).send();
  } catch (e) { next(e); }
}
```

Note that `list` no longer takes `_req`.

- [ ] **Step 9: Update the service test**

In `apps/api/test/clients/client.service.test.ts`, create a user in `beforeEach` and pass its id as the first argument to every service call:

```ts
import { signInAs } from "../helpers/auth.js";

let ownerId: string;

beforeEach(async () => {
  await resetDb();
  ({ user: { id: ownerId } } = await signInAs());
});
```

- [ ] **Step 10: Run the client tests and watch them pass**

Run: `npm test -w @adpulse/api -- clients`
Expected: PASS, including the three new isolation tests.

- [ ] **Step 11: Run the whole suite**

Run: `npm test`
Expected: FAIL in the campaign, property, record and value files — they create clients through the API, which now works, but their services still ignore the owner. Confirm the failures are only assertion-level and not `ownerId` violations, then continue to Task 9.

If any file fails with a Prisma error about `ownerId`, it creates a client directly through `prisma.client.create`; give that call an `ownerId` from `signInAs`.

- [ ] **Step 12: Commit**

```bash
git add apps/api/prisma apps/api/src apps/api/test/clients
git commit -m "feat(clients): scope clients to their owner"
```

---

### Task 9: Campaigns behind their client's owner

**Files:**
- Modify: `apps/api/src/campaigns/campaign.service.ts`, `apps/api/src/campaigns/campaign.controller.ts`
- Modify: `apps/api/src/records/value.service.ts` (its call to `getCampaignTable`)
- Modify: `apps/api/test/campaigns/campaign.service.test.ts`, `apps/api/test/campaigns/campaign.api.test.ts`

**Interfaces:**
- Consumes: `ownedCampaign` (Task 8), `userId` (Task 7).
- Produces: `createCampaign(ownerId, clientId, input)`, `listCampaigns(ownerId, clientId)`, `getCampaign(ownerId, id)`, `getCampaignTable(ownerId, id)`, `updateCampaign(ownerId, id, input)`, `deleteCampaign(ownerId, id)`.

- [ ] **Step 1: Write the failing test**

Add to `apps/api/test/campaigns/campaign.api.test.ts`:

```ts
it("GET /api/campaigns/:id for another user's campaign -> 404", async () => {
  const other = await signInAs("Other");
  const theirClient = await request(app).post("/api/clients").set(other.auth)
    .send({ name: "Theirs" });
  const theirCampaigns = await request(app)
    .get(`/api/clients/${theirClient.body.id}/campaigns`).set(other.auth);

  const res = await request(app)
    .get(`/api/campaigns/${theirCampaigns.body[0].id}`).set(auth);
  expect(res.status).toBe(404);
});

it("GET /api/clients/:clientId/campaigns for another user's client -> 404", async () => {
  const other = await signInAs("Other");
  const theirClient = await request(app).post("/api/clients").set(other.auth)
    .send({ name: "Theirs" });

  const res = await request(app)
    .get(`/api/clients/${theirClient.body.id}/campaigns`).set(auth);
  expect(res.status).toBe(404);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test -w @adpulse/api -- campaign.api`
Expected: FAIL — both requests answer 200 with another user's data.

- [ ] **Step 3: Thread the owner through the service**

In `apps/api/src/campaigns/campaign.service.ts`:

```ts
import { ownedCampaign, ownedClient } from "../auth/scope.js";

async function assertClientOwned(ownerId: string, clientId: string): Promise<void> {
  const client = await prisma.client.findFirst({ where: ownedClient(ownerId, clientId) });
  if (!client) throw new NotFoundError("Client not found");
}

export async function createCampaign(
  ownerId: string,
  clientId: string,
  input: { name: string },
): Promise<Campaign> {
  await assertClientOwned(ownerId, clientId);
  const position = await prisma.campaign.count({ where: { clientId } });
  return prisma.campaign.create({
    data: { clientId, ...buildCampaignCreateData(input.name, position) },
  });
}

export async function listCampaigns(ownerId: string, clientId: string): Promise<Campaign[]> {
  await assertClientOwned(ownerId, clientId);
  return prisma.campaign.findMany({ where: { clientId }, orderBy: { position: "asc" } });
}

export async function getCampaign(ownerId: string, id: string): Promise<Campaign> {
  const campaign = await prisma.campaign.findFirst({ where: ownedCampaign(ownerId, id) });
  if (!campaign) throw new NotFoundError("Campaign not found");
  return campaign;
}

export async function getCampaignTable(ownerId: string, id: string): Promise<CampaignPayload> {
  const campaign = await prisma.campaign.findFirst({
    where: ownedCampaign(ownerId, id),
    include: {
      properties: { orderBy: { position: "asc" } },
      records: { orderBy: { date: "asc" }, include: { values: true } },
    },
  });
  if (!campaign) throw new NotFoundError("Campaign not found");
  // ...the rest of the body is unchanged
}
```

`updateCampaign` and `deleteCampaign` gain `ownerId` as their first parameter and pass it to `getCampaign`. `normalizePositions` is unchanged: it works from a `clientId` that the call above has already vetted.

- [ ] **Step 4: Update the controller**

Import the accessor in `apps/api/src/campaigns/campaign.controller.ts` and pass it first in every handler:

```ts
import { userId } from "../auth/current-user.js";

// A route mounted at /api/clients/:clientId/campaigns:
export async function create(
  req: Request<{ clientId: string }>, res: Response, next: NextFunction,
) {
  try {
    const data = createCampaignSchema.parse(req.body);
    res.status(201).json(await createCampaign(userId(req), req.params.clientId, data));
  } catch (e) { next(e); }
}

// A route mounted at /api/campaigns:
export async function getOne(
  req: Request<{ id: string }>, res: Response, next: NextFunction,
) {
  try {
    res.json(await getCampaignTable(userId(req), req.params.id));
  } catch (e) { next(e); }
}
```

Apply the same shape to every remaining handler in the file: `userId(req)` goes first, the existing arguments follow unchanged. Keep each handler's Zod parsing exactly as it is.

- [ ] **Step 5: Fix the one internal caller**

`setPropertyValue` in `apps/api/src/records/value.service.ts` calls `getCampaignTable(record.campaignId)`. Give that function an `ownerId` first parameter and pass it through:

```ts
export async function setPropertyValue(
  ownerId: string,
  recordId: string,
  propertyId: string,
  value: string | null,
): Promise<ValueWriteResult> {
  // ...unchanged body...
  const table = await getCampaignTable(ownerId, record.campaignId);
```

Its own record lookup gains the filter in Task 11; this step only keeps the file compiling.

Also update `apps/api/src/records/value.controller.ts` to pass `userId(req)` first.

- [ ] **Step 6: Update the service test**

In `apps/api/test/campaigns/campaign.service.test.ts`, add the fixture and pass its id first to every service call:

```ts
import { signInAs } from "../helpers/auth.js";

let ownerId: string;

beforeEach(async () => {
  await resetDb();
  ({ user: { id: ownerId } } = await signInAs());
});
```

Any client the file creates directly through `prisma.client.create` needs `ownerId` in its `data`; a client created through the service or the API already gets one.

- [ ] **Step 7: Run the campaign tests and watch them pass**

Run: `npm test -w @adpulse/api -- campaign`
Expected: PASS, including the two new isolation tests.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src apps/api/test/campaigns
git commit -m "feat(campaigns): scope campaigns to their client's owner"
```

---

### Task 10: Properties behind their campaign's owner

**Files:**
- Modify: `apps/api/src/properties/property.service.ts`, `apps/api/src/properties/property.controller.ts`
- Modify: `apps/api/test/properties/property.service.test.ts`, `apps/api/test/properties/property.api.test.ts`

**Interfaces:**
- Consumes: `ownedCampaign`, `ownedProperty` (Task 8).
- Produces: `createProperty(ownerId, campaignId, input)`, `updateProperty(ownerId, id, input)`, `deleteProperty(ownerId, id)`.

- [ ] **Step 1: Write the failing test**

Add to `apps/api/test/properties/property.api.test.ts` (adapt the setup helpers already in that file for creating another user's campaign):

```ts
it("POST /api/campaigns/:campaignId/properties on another user's campaign -> 404", async () => {
  const other = await signInAs("Other");
  const theirClient = await request(app).post("/api/clients").set(other.auth)
    .send({ name: "Theirs" });
  const theirCampaigns = await request(app)
    .get(`/api/clients/${theirClient.body.id}/campaigns`).set(other.auth);

  const res = await request(app)
    .post(`/api/campaigns/${theirCampaigns.body[0].id}/properties`).set(auth)
    .send({ name: "Spend", type: "MONEY" });
  expect(res.status).toBe(404);
});

it("DELETE /api/properties/:id for another user's property -> 404", async () => {
  const other = await signInAs("Other");
  const theirClient = await request(app).post("/api/clients").set(other.auth)
    .send({ name: "Theirs" });
  const theirCampaigns = await request(app)
    .get(`/api/clients/${theirClient.body.id}/campaigns`).set(other.auth);
  const theirTable = await request(app)
    .get(`/api/campaigns/${theirCampaigns.body[0].id}`).set(other.auth);

  const res = await request(app)
    .delete(`/api/properties/${theirTable.body.properties[0].id}`).set(auth);
  expect(res.status).toBe(404);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test -w @adpulse/api -- property.api`
Expected: FAIL — both requests succeed against another user's data.

- [ ] **Step 3: Thread the owner through the service**

In `apps/api/src/properties/property.service.ts`:

```ts
import { ownedCampaign, ownedProperty } from "../auth/scope.js";

async function getProperty(ownerId: string, id: string): Promise<CampaignProperty> {
  const property = await prisma.campaignProperty.findFirst({
    where: ownedProperty(ownerId, id),
  });
  if (!property) throw new NotFoundError("Property not found");
  return property;
}
```

`createProperty` takes `ownerId` first and replaces its campaign lookup:

```ts
const campaign = await prisma.campaign.findFirst({ where: ownedCampaign(ownerId, campaignId) });
if (!campaign) throw new NotFoundError("Campaign not found");
```

Its final `return getProperty(id)` becomes `return getProperty(ownerId, id)`. `updateProperty` and `deleteProperty` take `ownerId` first and pass it to every `getProperty` call.

`siblings`, `reorder` and `countValues` are unchanged: each works from a `campaignId` or a property id that the entry lookup has already vetted.

- [ ] **Step 4: Update the controller**

```ts
// apps/api/src/properties/property.controller.ts
import { userId } from "../auth/current-user.js";

export async function create(
  req: Request<{ campaignId: string }>, res: Response, next: NextFunction,
) {
  try {
    const data = createPropertySchema.parse(req.body);
    res.status(201).json(await createProperty(userId(req), req.params.campaignId, data));
  } catch (e) { next(e); }
}

export async function remove(
  req: Request<{ id: string }>, res: Response, next: NextFunction,
) {
  try {
    await deleteProperty(userId(req), req.params.id);
    res.status(204).send();
  } catch (e) { next(e); }
}
```

`update` follows the same shape: `userId(req)` first, then `req.params.id`, then the parsed body.

- [ ] **Step 5: Update the service test**

In `apps/api/test/properties/property.service.test.ts`, add the fixture and pass its id first to every service call:

```ts
import { signInAs } from "../helpers/auth.js";

let ownerId: string;

beforeEach(async () => {
  await resetDb();
  ({ user: { id: ownerId } } = await signInAs());
});
```

Any client the file creates directly through `prisma.client.create` needs `ownerId` in its `data`.

- [ ] **Step 6: Run the property tests and watch them pass**

Run: `npm test -w @adpulse/api -- propert`
Expected: PASS, including the two new isolation tests.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src apps/api/test/properties
git commit -m "feat(properties): scope properties to their campaign's owner"
```

---

### Task 11: Records and values behind their campaign's owner

**Files:**
- Modify: `apps/api/src/records/record.service.ts`, `apps/api/src/records/record.controller.ts`, `apps/api/src/records/value.service.ts`
- Modify: `apps/api/test/records/record.api.test.ts`, `apps/api/test/records/value.api.test.ts`

**Interfaces:**
- Consumes: `ownedCampaign`, `ownedRecord` (Task 8).
- Produces: `createRecord(ownerId, campaignId, input)`, `updateRecord(ownerId, id, input)`, `deleteRecord(ownerId, id)`, `setPropertyValue(ownerId, recordId, propertyId, value)`.

- [ ] **Step 1: Write the failing tests**

Add to `apps/api/test/records/record.api.test.ts`:

```ts
it("POST /api/campaigns/:campaignId/records on another user's campaign -> 404", async () => {
  const other = await signInAs("Other");
  const theirClient = await request(app).post("/api/clients").set(other.auth)
    .send({ name: "Theirs" });
  const theirCampaigns = await request(app)
    .get(`/api/clients/${theirClient.body.id}/campaigns`).set(other.auth);

  const res = await request(app)
    .post(`/api/campaigns/${theirCampaigns.body[0].id}/records`).set(auth)
    .send({ date: "2026-08-13" });
  expect(res.status).toBe(404);
});

it("DELETE /api/records/:id for another user's record -> 404 and keeps it", async () => {
  const other = await signInAs("Other");
  const theirClient = await request(app).post("/api/clients").set(other.auth)
    .send({ name: "Theirs" });
  const theirCampaigns = await request(app)
    .get(`/api/clients/${theirClient.body.id}/campaigns`).set(other.auth);
  const theirRecord = await request(app)
    .post(`/api/campaigns/${theirCampaigns.body[0].id}/records`).set(other.auth)
    .send({ date: "2026-08-13" });

  const res = await request(app).delete(`/api/records/${theirRecord.body.id}`).set(auth);
  expect(res.status).toBe(404);
  expect(await prisma.campaignRecord.count()).toBe(1);
});
```

Add to `apps/api/test/records/value.api.test.ts`:

```ts
it("PUT /api/records/:recordId/values/:propertyId on another user's row -> 404", async () => {
  const other = await signInAs("Other");
  const theirClient = await request(app).post("/api/clients").set(other.auth)
    .send({ name: "Theirs" });
  const theirCampaigns = await request(app)
    .get(`/api/clients/${theirClient.body.id}/campaigns`).set(other.auth);
  const theirTable = await request(app)
    .get(`/api/campaigns/${theirCampaigns.body[0].id}`).set(other.auth);
  const theirRecord = await request(app)
    .post(`/api/campaigns/${theirCampaigns.body[0].id}/records`).set(other.auth)
    .send({ date: "2026-08-13" });
  const entered = theirTable.body.properties.find(
    (property: { formula: unknown }) => property.formula === null,
  );

  const res = await request(app)
    .put(`/api/records/${theirRecord.body.id}/values/${entered.id}`).set(auth)
    .send({ value: "100" });
  expect(res.status).toBe(404);
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npm test -w @adpulse/api -- record.api value.api`
Expected: FAIL — all three requests succeed against another user's data.

- [ ] **Step 3: Thread the owner through `record.service`**

```ts
import { ownedCampaign, ownedRecord } from "../auth/scope.js";

async function getRecord(ownerId: string, id: string): Promise<CampaignRecord> {
  const record = await prisma.campaignRecord.findFirst({ where: ownedRecord(ownerId, id) });
  if (!record) throw new NotFoundError("Record not found");
  return record;
}
```

`createRecord` takes `ownerId` first and replaces its campaign lookup with
`prisma.campaign.findFirst({ where: ownedCampaign(ownerId, campaignId) })`.
`updateRecord` and `deleteRecord` take `ownerId` first and pass it to `getRecord`.
`assertDateIsFree` is unchanged — it goes by the composite key and sits below the check.

- [ ] **Step 4: Filter the record lookup in `value.service`**

```ts
const record = await prisma.campaignRecord.findFirst({
  where: ownedRecord(ownerId, recordId),
});
if (!record) throw new NotFoundError("Record not found");
```

The property lookup below it stays as it is. It already requires
`property.campaignId === record.campaignId`, and a record that belongs to the
caller has a campaign that belongs to the caller — so a property of that
campaign does too. A second filter would be a query to prove something already
proven.

- [ ] **Step 5: Update the controllers**

Every handler in `apps/api/src/records/record.controller.ts` passes `userId(req)` first. `value.controller.ts` was already updated in Task 9, Step 5.

- [ ] **Step 6: Run the record and value tests and watch them pass**

Run: `npm test -w @adpulse/api -- record value`
Expected: PASS, including the three new isolation tests.

- [ ] **Step 7: Run the whole suite**

Run: `npm test`
Expected: PASS — every file green.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src apps/api/test/records
git commit -m "feat(records): scope records and values to their campaign's owner"
```

---

## Done when

- `npm test` passes from the repository root.
- No route under `/api` other than `/api/auth/*` answers anything but 401 without a bearer token.
- A resource belonging to another user answers 404 for clients, campaigns, properties, records and values.
- No service function reads a client, campaign, property, record or value without an `ownerId`.
