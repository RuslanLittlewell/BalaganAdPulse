import type { PresencePerson } from "../domain/presence.js";

const PRESENCE_WINDOW_MS = 5 * 60_000;

export const PRESENCE_SWEEP_MS = 30_000;

export interface PresenceRegistryOptions {
  readonly now?: () => number;
  readonly windowMs?: number;
}

export interface PresenceDeparture {
  readonly person: PresencePerson;
  readonly lastSeenAt: Date;
}

export interface PresenceRegistry {
  seen(userId: string): boolean;
  join(person: PresencePerson): void;
  leave(userId: string): PresencePerson | null;
  sweep(): readonly PresenceDeparture[];
  list(): readonly PresencePerson[];
  clear(): void;
}

interface Entry {
  person: PresencePerson;
  lastSeenAt: number;
}

export function createPresenceRegistry(options: PresenceRegistryOptions = {}): PresenceRegistry {
  const now = options.now ?? (() => Date.now());
  const windowMs = options.windowMs ?? PRESENCE_WINDOW_MS;
  const entries = new Map<string, Entry>();

  const here = (entry: Entry) => now() - entry.lastSeenAt <= windowMs;

  return {
    seen(userId) {
      const entry = entries.get(userId);
      if (!entry || !here(entry)) return false;
      entry.lastSeenAt = now();
      return true;
    },

    join(person) {
      entries.set(person.userId, { person, lastSeenAt: now() });
    },

    leave(userId) {
      const entry = entries.get(userId);
      if (!entry) return null;
      entries.delete(userId);
      return entry.person;
    },

    sweep() {
      const gone: PresenceDeparture[] = [];
      for (const [userId, entry] of entries) {
        if (here(entry)) continue;
        entries.delete(userId);
        gone.push({ person: entry.person, lastSeenAt: new Date(entry.lastSeenAt) });
      }
      return gone;
    },

    list: () => [...entries.values()].filter(here).map((entry) => entry.person),

    clear: () => { entries.clear(); },
  };
}
