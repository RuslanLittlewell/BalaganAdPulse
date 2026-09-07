import { isCustomer } from "@adpulse/access-policy";
import type { Role } from "@adpulse/access-policy";

export interface PresencePerson {
  readonly userId: string;
  readonly membershipId: string;
  readonly orgId: string;
  readonly role: Role;
  readonly name: string;
  readonly image: string | null;
  readonly clientIds: readonly string[];
}

export interface PresenceViewer {
  readonly orgId: string;
  readonly role: Role;
  readonly clientIds: readonly string[];
}

export function discloses(viewer: PresenceViewer, person: PresencePerson): boolean {
  if (viewer.orgId !== person.orgId) return false;
  if (!isCustomer(viewer.role) || !isCustomer(person.role)) return true;
  return person.clientIds.some((clientId) => viewer.clientIds.includes(clientId));
}
