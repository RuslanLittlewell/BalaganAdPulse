import type { Role } from "@adpulse/access-policy";

export type MembershipStatus = "ACTIVE" | "SUSPENDED";

export interface MemberRecord {
  readonly id: string;
  readonly userId: string;
  readonly orgId: string;
  readonly name: string;
  readonly email: string;
  readonly image: string | null;
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

export function wouldStopBeingAdmin(member: MemberRecord, change: MemberChange): boolean {
  if (!isActiveAdmin(member)) return false;
  return !isActiveAdmin({
    role: change.role ?? member.role,
    status: change.status ?? member.status,
  });
}
