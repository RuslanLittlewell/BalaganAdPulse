import type { ActorContext } from "#shared/application/index.js";
import type { PresencePerson } from "../domain/presence.js";
import type { PresenceRegistry } from "./presence-registry.js";

export interface PresenceProfile {
  readonly image: string | null;
  readonly clientIds: readonly string[];
}

export interface PresenceProfiles {
  describe(actor: ActorContext): Promise<PresenceProfile>;
}

export interface PresenceAnnouncements {
  joined(person: PresencePerson): void;
  left(person: PresencePerson): void;
}

export interface PresenceServiceDependencies {
  readonly registry: PresenceRegistry;
  readonly profiles: PresenceProfiles;
  readonly announce: PresenceAnnouncements;
}

export interface PresenceService {
  touch(actor: ActorContext, name: string): void;
  leave(userId: string): void;
  sweep(): void;
}

export function createPresenceService(
  dependencies: PresenceServiceDependencies,
): PresenceService {
  const { registry, profiles, announce } = dependencies;
  const arriving = new Set<string>();

  return {
    touch(actor, name) {
      if (registry.seen(actor.userId)) return;
      if (arriving.has(actor.userId)) return;
      arriving.add(actor.userId);

      profiles
        .describe(actor)
        .then(({ image, clientIds }) => {
          const person: PresencePerson = {
            userId: actor.userId,
            membershipId: actor.membershipId,
            orgId: actor.orgId,
            role: actor.role,
            name,
            image,
            clientIds,
          };
          registry.join(person);
          announce.joined(person);
        })
        .catch(() => {})
        .finally(() => { arriving.delete(actor.userId); });
    },

    leave(userId) {
      const person = registry.leave(userId);
      if (person) announce.left(person);
    },

    sweep() {
      for (const person of registry.sweep()) announce.left(person);
    },
  };
}
