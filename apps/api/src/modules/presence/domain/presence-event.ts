import type { PresencePerson } from "./presence.js";

export interface PresenceEntry {
  readonly userId: string;
  readonly membershipId: string;
  readonly name: string;
  readonly image: string | null;
}

export interface PresenceState {
  readonly kind: "presence.state";
  readonly people: readonly PresenceEntry[];
}

export interface PresenceJoined {
  readonly kind: "presence.joined";
  readonly person: PresenceEntry;
}

export interface PresenceLeft {
  readonly kind: "presence.left";
  readonly userId: string;
}

export type PresenceEvent = PresenceState | PresenceJoined | PresenceLeft;

export function entryOf(person: PresencePerson): PresenceEntry {
  return {
    userId: person.userId,
    membershipId: person.membershipId,
    name: person.name,
    image: person.image,
  };
}

export function presenceState(people: readonly PresencePerson[]): PresenceState {
  return { kind: "presence.state", people: people.map(entryOf) };
}

export function presenceJoined(person: PresencePerson): PresenceJoined {
  return { kind: "presence.joined", person: entryOf(person) };
}

export function presenceLeft(userId: string): PresenceLeft {
  return { kind: "presence.left", userId };
}
