import type { Role } from "@adpulse/access-policy";

export interface ActorContext {
  readonly userId: string;
  readonly membershipId: string;
  readonly orgId: string;
  readonly role: Role;
}
