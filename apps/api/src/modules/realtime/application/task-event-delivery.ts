import { can } from "@adpulse/access-policy";
import type { ActorContext } from "../../../shared/application/index.js";
import type { SessionPrincipal } from "../../identity/index.js";
import type { TaskEvent } from "../../tasks/index.js";
import type { Connection, ConnectionRegistry } from "./connection-registry.js";

/** Resolving a principal into the organization they are acting in. The same
 * contract the HTTP middleware uses, so a socket cannot end up with a different
 * notion of the caller than a request would. */
export interface DeliveryActorResolution {
  resolveActor(principal: SessionPrincipal): Promise<ActorContext>;
}

/** Whether an actor reaches a project. Answers null when they do not. */
export interface DeliveryProjectReach {
  contextFor(actor: ActorContext, projectId: string): Promise<{ clientId: string } | null>;
}

export interface TaskEventDeliveryDependencies {
  readonly registry: ConnectionRegistry;
  readonly members: DeliveryActorResolution;
  readonly projects: DeliveryProjectReach;
}

/**
 * Decides who receives a task event, and hands it to them.
 *
 * The filter runs in the same order as the REST path — organization, then the
 * verb from the permission matrix, then project reach — and for the same
 * reason: a member who cannot reach a task must not be able to tell that it
 * exists. Here that means silence. There is no "denied" message, because
 * sending one would answer the question the filter exists to refuse.
 *
 * Entitlement is recomputed for every event rather than captured when the
 * socket opened. `resolveActor` is called on every HTTP request precisely so a
 * demotion or suspension takes effect on the next call; a connection that can
 * outlive several token lifetimes makes that more important, not less.
 */
export function createTaskEventDelivery(dependencies: TaskEventDeliveryDependencies) {
  const entitled = async (connection: Connection, event: TaskEvent): Promise<boolean> => {
    let actor: ActorContext;
    try {
      actor = await dependencies.members.resolveActor(connection.principal);
    } catch {
      // The membership is gone or suspended. Fail closed and stay silent.
      return false;
    }
    if (actor.orgId !== event.orgId) return false;
    if (!can(actor, "read", "task")) return false;
    return (await dependencies.projects.contextFor(actor, event.projectId)) !== null;
  };

  return {
    async deliver(event: TaskEvent): Promise<void> {
      await Promise.all(dependencies.registry.list().map(async (connection) => {
        try {
          if (await entitled(connection, event)) connection.send(event);
        } catch {
          // A dead socket must not silence the others, and must not surface as
          // a failure of the write that produced the event.
        }
      }));
    },
  };
}

export type TaskEventDelivery = ReturnType<typeof createTaskEventDelivery>;
