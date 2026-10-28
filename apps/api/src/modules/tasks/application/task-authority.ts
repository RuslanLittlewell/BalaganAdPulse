import { can } from "@adpulse/access-policy";
import type { ActorContext } from "#shared/application/index.js";
import type { TaskRecord } from "./ports.js";

export function ownsPersonal(actor: ActorContext, task: Pick<TaskRecord, "personal" | "createdById">): boolean {
  return task.personal && task.createdById === actor.membershipId;
}

export function mayChange(
  actor: ActorContext,
  task: Pick<TaskRecord, "personal" | "createdById">,
  action: "update" | "delete",
): boolean {
  return can(actor, action, "task") || ownsPersonal(actor, task);
}
