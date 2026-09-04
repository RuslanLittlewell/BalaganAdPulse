import { can, isCustomer } from "@adpulse/access-policy";
import type { ActorContext } from "#shared/application/index.js";
import type { SessionPrincipal } from "../../identity/index.js";
import type { TaskEvent } from "../../tasks/index.js";
import type { Connection, ConnectionRegistry } from "./connection-registry.js";

export interface DeliveryActorResolution {
  resolveActor(principal: SessionPrincipal): Promise<ActorContext>;
}

export interface DeliveryProjectReach {
  contextFor(actor: ActorContext, projectId: string): Promise<{ clientId: string } | null>;
}

export interface TaskEventDeliveryDependencies {
  readonly registry: ConnectionRegistry;
  readonly members: DeliveryActorResolution;
  readonly projects: DeliveryProjectReach;
}

function sees(actor: ActorContext, event: TaskEvent): boolean {
  if (actor.role === "ADMIN") return true;
  const { assigneeId, visibleToClient } = event.kind === "task.deleted" ? event : event.task;
  if (isCustomer(actor.role)) return visibleToClient;
  return assigneeId === actor.membershipId;
}

export function createTaskEventDelivery(dependencies: TaskEventDeliveryDependencies) {
  const entitled = async (connection: Connection, event: TaskEvent): Promise<boolean> => {
    let actor: ActorContext;
    try {
      actor = await dependencies.members.resolveActor(connection.principal);
    } catch {
      return false;
    }
    if (actor.orgId !== event.orgId) return false;
    if (!can(actor, "read", "task")) return false;
    if (!sees(actor, event)) return false;
    return (await dependencies.projects.contextFor(actor, event.projectId)) !== null;
  };

  return {
    async deliver(event: TaskEvent): Promise<void> {
      await Promise.all(dependencies.registry.list().map(async (connection) => {
        try {
          if (await entitled(connection, event)) connection.send(event);
        } catch {
        }
      }));
    },
  };
}

export type TaskEventDelivery = ReturnType<typeof createTaskEventDelivery>;
