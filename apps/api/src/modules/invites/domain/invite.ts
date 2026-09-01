import type { Role } from "@adpulse/access-policy";

export interface Invite {
  readonly id: string;
  readonly orgId: string;
  readonly code: string;
  readonly role: Role;
  /** When set, only a registration using this address may redeem it. */
  readonly email: string | null;
  readonly expiresAt: Date | null;
  readonly revokedAt: Date | null;
  readonly usedAt: Date | null;
  readonly usedById: string | null;
  readonly createdById: string | null;
  readonly createdAt: Date;
}

/** What an invitation is doing right now, derived rather than stored so the
 * three timestamps stay the single source of truth. Redemption wins over
 * everything: it is the record of how somebody actually joined. */
export type InviteStatus = "USED" | "REVOKED" | "EXPIRED" | "PENDING";

export function inviteStatus(invite: Invite, now: Date): InviteStatus {
  if (invite.usedAt) return "USED";
  if (invite.revokedAt) return "REVOKED";
  if (invite.expiresAt && invite.expiresAt.getTime() <= now.getTime()) return "EXPIRED";
  return "PENDING";
}

/** Whether this invitation may be redeemed right now, by this address. The
 * caller still has to claim it conditionally: this is a read, and two
 * registrations can pass it with the same code. */
export function isRedeemable(invite: Invite | null, email: string, now: Date): invite is Invite {
  return (
    invite !== null &&
    invite.usedAt === null &&
    invite.revokedAt === null &&
    (invite.expiresAt === null || invite.expiresAt.getTime() > now.getTime()) &&
    (invite.email === null || invite.email === email)
  );
}
