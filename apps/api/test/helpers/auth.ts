import type { Membership, Role, MembershipStatus, User } from "@prisma/client";
import type { Actor } from "@adpulse/access-policy";
import { randomUUID } from "node:crypto";
import { prisma } from "../../src/shared/infrastructure/prisma.js";

/** The same adapter production signs with, so a test token is a real one. */
const tokens = new TokenAdapter();
import { TokenAdapter } from "../../src/modules/identity/infrastructure/token-adapter.js";
import { enterWithRequestContext } from "../../src/shared/presentation/request-context.js";

export interface SignedIn {
  user: User;
  auth: { Authorization: string };
  /** Absent only when `membership: false` asked for a user outside the org. */
  membership?: Membership;
  /** The same thing loadActor would put on the request, for tests that call a
   * service directly instead of going through HTTP. */
  actor?: Actor;
}

export interface SignInOptions {
  role?: Role;
  status?: MembershipStatus;
  /** Set false to sign in a user who belongs to no organization at all — the
   * one case the actor middleware must refuse. */
  membership?: boolean;
}

/** The single organization every database gets from the tenancy migration.
 * Tests never create one: `resetDb` leaves it standing precisely so that a
 * test's clients and members have somewhere to live. */
export async function currentOrg(): Promise<{ id: string; name: string; slug: string }> {
  // Oldest first: a test may create a second organization to prove the tenancy
  // boundary, and "the" organization always means the migration's one.
  return prisma.organization.findFirstOrThrow({ orderBy: { createdAt: "asc" } });
}

/** A second organization, for the tests that prove nothing leaks across the
 * tenancy boundary. `resetDb` removes it again. */
export async function createOrg(name: string, slug: string) {
  return prisma.organization.create({ data: { name, slug } });
}

/** Signs in a member of a *different* organization, with their own client. */
export async function signInAsOutsider(name = "Outsider") {
  const org = await createOrg(`${name} Agency`, `${name.toLowerCase()}-agency`);
  const user = await prisma.user.create({
    data: { name, email: `${randomUUID()}@example.com`, passwordHash: "placeholder" },
  });
  const membership = await prisma.membership.create({
    data: { userId: user.id, orgId: org.id, role: "ADMIN", status: "ACTIVE" },
  });
  const client = await prisma.client.create({
    data: { name: `${name} Client`, orgId: org.id },
  });
  const token = await tokens.issueAccess({ id: user.id, name: user.name, email: user.email });
  return { org, user, membership, client, auth: { Authorization: `Bearer ${token}` } };
}

/** Gives a membership reach over a client, or over one project of it. */
export async function grantAccess(
  membershipId: string,
  clientId: string,
  projectId?: string,
): Promise<void> {
  await prisma.clientAccess.create({
    data: { membershipId, clientId, projectId: projectId ?? null },
  });
}

/** Creates a user, makes them a member, and signs a token for them directly
 * rather than going through /api/auth/login. scrypt is deliberately slow, and
 * hashing a password in every beforeEach would add seconds of waiting to the
 * suite. The stored hash is a placeholder: nothing in these tests verifies a
 * password.
 *
 * The default role is ADMIN because most tests predate roles and only care that
 * the caller can reach their own data; the tests that are *about* roles pass one
 * explicitly. */
export async function signInAs(
  name = "Buyer",
  options: SignInOptions = {},
): Promise<SignedIn> {
  const { role = "ADMIN", status = "ACTIVE", membership: withMembership = true } = options;
  const user = await prisma.user.create({
    data: { name, email: `${randomUUID()}@example.com`, passwordHash: "placeholder" },
  });
  const membership = withMembership
    ? await prisma.membership.create({
        data: { userId: user.id, orgId: (await currentOrg()).id, role, status },
      })
    : undefined;
  const token = await tokens.issueAccess({ id: user.id, name: user.name, email: user.email });
  const actor: Actor | undefined = membership && {
    userId: user.id,
    membershipId: membership.id,
    orgId: membership.orgId,
    role: membership.role,
  };
  if (actor) {
    enterWithRequestContext({
      actor: { ...actor, name: user.name, email: user.email },
      ip: null,
      userAgent: "service test",
      requestId: randomUUID(),
    });
  }
  return { user, auth: { Authorization: `Bearer ${token}` }, membership, actor };
}

export interface InviteOptions {
  role?: Role;
  /** The projects an employee invitation grants. An employee invitation with
   * none is historical — it predates project scoping — so the ordinary list
   * leaves it out; pass at least one to create an actionable invitation. */
  projectIds?: string[];
  email?: string;
  expiresAt?: Date | null;
  revokedAt?: Date | null;
  usedAt?: Date | null;
  createdById?: string;
}

/** A pending invitation, ready to be redeemed by a registration. The code is
 * fixed per call rather than random so a failing test names the code it used. */
export async function createInvite(
  code: string,
  options: InviteOptions = {},
): Promise<{ id: string; code: string; role: Role }> {
  const {
    role = "MANAGER", projectIds, email, expiresAt, revokedAt, usedAt, createdById,
  } = options;
  const invite = await prisma.invite.create({
    data: {
      orgId: (await currentOrg()).id,
      code,
      role,
      email,
      expiresAt: expiresAt ?? null,
      revokedAt: revokedAt ?? null,
      usedAt: usedAt ?? null,
      createdById,
      ...(projectIds?.length
        ? { projects: { create: projectIds.map((projectId) => ({ projectId })) } }
        : {}),
    },
  });
  return { id: invite.id, code: invite.code, role: invite.role };
}
