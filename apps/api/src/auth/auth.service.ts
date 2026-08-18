import { Prisma, type User } from "@prisma/client";
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

/** A syntactically valid `salt:key` pair (32 hex chars : 128 hex chars, the
 * shapes `hashPassword` produces) used to stand in for a real password hash
 * when the email in `login` does not match a user. `verifyPassword` bails
 * out before running scrypt on a malformed value, so anything short of this
 * exact shape would let an unknown email skip the scrypt cost and answer
 * measurably faster than a wrong password — turning response time into the
 * same enumeration channel the identical error message is meant to close. */
export const DUMMY_PASSWORD_HASH = `${"0123456789abcdef".repeat(2)}:${"0123456789abcdef".repeat(8)}`;

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
  // No pre-check: two simultaneous registrations of the same address would both
  // pass it and both reach `create`, and the loser would surface a raw Prisma
  // error instead of the 409 promised here. The unique constraint is the one
  // arbiter that cannot be raced, so the conflict is read off its violation.
  let user: User;
  try {
    user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash: await hashPassword(input.password),
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictError("This email is already registered");
    }
    throw error;
  }
  return issueTokens(user);
}

export async function login(input: LoginInput): Promise<TokenPair> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  // Always run the scrypt comparison, even when no user matches: skipping it
  // for an unknown email would make that response return ~100x faster than a
  // wrong password, turning response time into an enumeration channel even
  // though the message and status are byte-identical either way.
  const passwordMatches = await verifyPassword(
    input.password,
    user?.passwordHash ?? DUMMY_PASSWORD_HASH,
  );
  if (!user || !passwordMatches) {
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
