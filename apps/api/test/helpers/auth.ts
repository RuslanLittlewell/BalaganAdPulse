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
