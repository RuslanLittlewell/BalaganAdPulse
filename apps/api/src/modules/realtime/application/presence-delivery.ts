import { isCustomer } from "@adpulse/access-policy";
import type { ActorContext } from "#shared/application/index.js";
import { discloses, presenceJoined, presenceLeft, presenceState } from "../../presence/index.js";
import type { PresencePerson, PresenceRegistry, PresenceViewer } from "../../presence/index.js";
import type { Connection, ConnectionRegistry } from "./connection-registry.js";
import type { DeliveryActorResolution } from "./task-event-delivery.js";

export interface PresenceClientReach {
  reachableIds(actor: ActorContext): Promise<readonly string[]>;
}

export interface PresenceDeliveryDependencies {
  readonly connections: ConnectionRegistry;
  readonly presence: PresenceRegistry;
  readonly members: DeliveryActorResolution;
  readonly clients: PresenceClientReach;
}

export function createPresenceDelivery(dependencies: PresenceDeliveryDependencies) {
  const viewerOf = async (connection: Connection): Promise<PresenceViewer | null> => {
    try {
      const actor = await dependencies.members.resolveActor(connection.principal);
      const clientIds = isCustomer(actor.role)
        ? await dependencies.clients.reachableIds(actor)
        : [];
      return { orgId: actor.orgId, role: actor.role, clientIds };
    } catch {
      return null;
    }
  };

  const tell = async (person: PresencePerson, what: (person: PresencePerson) => unknown) => {
    await Promise.all(dependencies.connections.list().map(async (connection) => {
      try {
        const viewer = await viewerOf(connection);
        if (viewer && discloses(viewer, person)) {
          connection.send(what(person) as Parameters<Connection["send"]>[0]);
        }
      } catch {
      }
    }));
  };

  return {
    async greet(connection: Connection): Promise<void> {
      const viewer = await viewerOf(connection);
      if (!viewer) return;
      connection.send(presenceState(
        dependencies.presence.list().filter((person) => discloses(viewer, person)),
      ));
    },

    deliverJoined: (person: PresencePerson) => tell(person, presenceJoined),

    deliverLeft: (person: PresencePerson) => tell(person, (who) => presenceLeft(who.userId)),
  };
}

export type PresenceDelivery = ReturnType<typeof createPresenceDelivery>;
