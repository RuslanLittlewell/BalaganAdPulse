import type { PresencePerson } from "../domain/presence.js";

export const PRESENCE_WINDOW_MS = 5 * 60_000;

export const PRESENCE_SWEEP_MS = 30_000;

export interface PresenceRegistryOptions {
  readonly now?: () => number;
  readonly windowMs?: number;
}

export interface PresenceRegistry {
  seen(userId: string): boolean;
  join(person: PresencePerson): void;
  leave(userId: string): PresencePerson | null;
  sweep(): readonly PresencePerson[];
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
      const gone: PresencePerson[] = [];
      for (const [userId, entry] of entries) {
        if (here(entry)) continue;
        entries.delete(userId);
        gone.push(entry.person);
      }
      return gone;
    },

    list: () => [...entries.values()].filter(here).map((entry) => entry.person),

    clear: () => { entries.clear(); },
  };
}
