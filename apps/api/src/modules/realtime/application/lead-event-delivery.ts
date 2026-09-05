import { can } from "@adpulse/access-policy";
import type { ActorContext } from "#shared/application/index.js";
import type { LeadEvent } from "../../leads/index.js";
import type { Connection, ConnectionRegistry } from "./connection-registry.js";
import type { DeliveryActorResolution } from "./task-event-delivery.js";

export interface DeliveryBoardReach {
  reaches(actor: ActorContext, board: string): Promise<boolean>;
}

export interface LeadEventDeliveryDependencies {
  readonly registry: ConnectionRegistry;
  readonly members: DeliveryActorResolution;
  readonly boards: DeliveryBoardReach;
}

export function createLeadEventDelivery(dependencies: LeadEventDeliveryDependencies) {
  const entitled = async (connection: Connection, event: LeadEvent): Promise<boolean> => {
    let actor: ActorContext;
    try {
      actor = await dependencies.members.resolveActor(connection.principal);
    } catch {
      return false;
    }
    if (actor.orgId !== event.orgId) return false;
    if (!can(actor, "read", "lead")) return false;
    return dependencies.boards.reaches(actor, event.board);
  };

  return {
    async deliver(event: LeadEvent): Promise<void> {
      await Promise.all(dependencies.registry.list().map(async (connection) => {
        try {
          if (await entitled(connection, event)) connection.send(event);
        } catch {
        }
      }));
    },
  };
}

export type LeadEventDelivery = ReturnType<typeof createLeadEventDelivery>;
