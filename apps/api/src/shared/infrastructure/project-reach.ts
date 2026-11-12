import type { Prisma } from "@prisma/client";
import type { ActorContext } from "#shared/application/index.js";

export function grantedProjects(actor: ActorContext): Prisma.ProjectWhereInput {
  if (actor.sharedProjectId !== undefined) return { OR: [{ id: actor.sharedProjectId }] };
  return {
    OR: [
      { client: { access: { some: { membershipId: actor.membershipId, projectId: null } } } },
      { access: { some: { membershipId: actor.membershipId } } },
    ],
  };
}

export function reachableProjects(actor: ActorContext): Prisma.ProjectWhereInput {
  if (actor.sharedProjectId !== undefined) return { client: { orgId: actor.orgId }, ...grantedProjects(actor) };
  if (actor.role === "ADMIN") return { client: { orgId: actor.orgId } };
  return { client: { orgId: actor.orgId }, ...grantedProjects(actor) };
}
