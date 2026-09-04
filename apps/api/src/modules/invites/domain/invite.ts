import type { Role } from "@adpulse/access-policy";

export type RegistrationType = "CLIENT" | "EMPLOYEE" | "CLIENT_STAFF";

export interface Invite {
  readonly id: string;
  readonly orgId: string;
  readonly code: string;
  readonly registrationType: RegistrationType;
  readonly role: Role | null;
  readonly projectIds: readonly string[];
  readonly clientId: string | null;
  readonly email: string | null;
  readonly expiresAt: Date | null;
  readonly revokedAt: Date | null;
  readonly usedAt: Date | null;
  readonly usedById: string | null;
  readonly createdById: string | null;
  readonly createdAt: Date;
}

export type InviteStatus = "USED" | "REVOKED" | "EXPIRED" | "PENDING";

export function inviteStatus(invite: Invite, now: Date): InviteStatus {
  if (invite.usedAt) return "USED";
  if (invite.revokedAt) return "REVOKED";
  if (invite.expiresAt && invite.expiresAt.getTime() <= now.getTime()) return "EXPIRED";
  return "PENDING";
}

export function isRedeemable(invite: Invite | null, email: string, now: Date): invite is Invite {
  return (
    invite !== null &&
    invite.usedAt === null &&
    invite.revokedAt === null &&
    (invite.expiresAt === null || invite.expiresAt.getTime() > now.getTime()) &&
    (invite.email === null || invite.email === email)
  );
}
