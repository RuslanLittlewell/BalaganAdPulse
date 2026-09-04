import type { Membership, Role, MembershipStatus, User } from "@prisma/client";
import type { Actor } from "@adpulse/access-policy";
import { randomUUID } from "node:crypto";
import { prisma } from "../../src/shared/infrastructure/prisma.js";

const tokens = new TokenAdapter();
import { TokenAdapter } from "../../src/modules/identity/infrastructure/token-adapter.js";
import { enterWithRequestContext } from "../../src/shared/presentation/request-context.js";

export interface SignedIn {
  user: User;
  auth: { Authorization: string };
  membership?: Membership;
  actor?: Actor;
}

export interface SignInOptions {
  role?: Role;
  status?: MembershipStatus;
  membership?: boolean;
}

export async function currentOrg(): Promise<{ id: string; name: string; slug: string }> {
  return prisma.organization.findFirstOrThrow({ orderBy: { createdAt: "asc" } });
}

export async function createOrg(name: string, slug: string) {
  return prisma.organization.create({ data: { name, slug } });
}

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

export async function grantAccess(
  membershipId: string,
  clientId: string,
  projectId?: string,
): Promise<void> {
  await prisma.clientAccess.create({
    data: { membershipId, clientId, projectId: projectId ?? null },
  });
}

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
  projectIds?: string[];
  email?: string;
  expiresAt?: Date | null;
  revokedAt?: Date | null;
  usedAt?: Date | null;
  createdById?: string;
}

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
