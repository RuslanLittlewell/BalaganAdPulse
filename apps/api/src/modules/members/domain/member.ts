import type { Role } from "@adpulse/access-policy";

export type MembershipStatus = "ACTIVE" | "SUSPENDED";

/** A person's place in an organization, flattened with the identity fields the
 * team screen shows — the interface lists people, not join rows. */
export interface MemberRecord {
  readonly id: string;
  readonly userId: string;
  readonly orgId: string;
  readonly name: string;
  readonly email: string;
  readonly image: string | null;
  /** How to reach them. The person's own, and never required. */
  readonly phone: string | null;
  readonly telegram: string | null;
  readonly role: Role;
  readonly status: MembershipStatus;
  readonly createdAt: Date;
}

export interface MemberChange {
  readonly role?: Role;
  readonly status?: MembershipStatus;
}

export function isActiveAdmin(member: { role: Role; status: MembershipStatus }): boolean {
  return member.role === "ADMIN" && member.status === "ACTIVE";
}

/**
 * Whether a change would take away this member's ability to administer the
 * organization. Demotion, suspension and removal are the same hazard, so they
 * are one question: an organization whose only admin is suspended is just as
 * stuck as one whose admin was deleted, and no endpoint could undo it.
 */
export function wouldStopBeingAdmin(member: MemberRecord, change: MemberChange): boolean {
  if (!isActiveAdmin(member)) return false;
  return !isActiveAdmin({
    role: change.role ?? member.role,
    status: change.status ?? member.status,
  });
}
