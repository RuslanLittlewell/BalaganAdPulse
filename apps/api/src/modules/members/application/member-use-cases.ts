import { can } from "@adpulse/access-policy";
import { AppError } from "#shared/domain/index.js";
import type { ActorContext } from "#shared/application/index.js";
import type { SessionPrincipal } from "../../identity/index.js";
import { wouldStopBeingAdmin } from "../domain/member.js";
import type { MemberChange } from "../domain/member.js";
import type {
  AccessGrant,
  MemberDependencies,
  MemberManagementDependencies,
  MemberKind,
  SessionDependencies,
} from "./ports.js";

export interface SetAccessInput {
  readonly grants: readonly { clientId: string; projectId?: string | null }[];
}

export function createMemberUseCases(
  dependencies: MemberDependencies & SessionDependencies & MemberManagementDependencies,
) {
  const assertCan = (actor: ActorContext, action: "read" | "update" | "delete") => {
    if (!can(actor, action, "member")) {
      throw new AppError("forbidden", `Your role may not ${action} a member`);
    }
  };

  const reachable = async (actor: ActorContext, id: string) => {
    const member = await dependencies.directory.findInOrg(actor.orgId, id);
    if (!member) throw new AppError("not-found", "Member not found");
    return member;
  };

  const assertNotTheLastAdmin = async (
    member: Awaited<ReturnType<typeof reachable>>,
    change: MemberChange,
  ) => {
    if (!wouldStopBeingAdmin(member, change)) return;
    const others = await dependencies.directory.countOtherActiveAdmins(member.orgId, member.id);
    if (others === 0) {
      throw new AppError("conflict", "The organization would be left without an active admin");
    }
  };

  return {
    resolveActor: async (principal: SessionPrincipal): Promise<ActorContext> => {
      const actor = await dependencies.memberships.findActiveByUserId(principal.id);
      if (!actor) {
        throw new AppError(
          "forbidden",
          "Your account is not an active member of this organization",
        );
      }
      return actor;
    },

    list: async (actor: ActorContext, kind?: MemberKind) => {
      assertCan(actor, "read");
      return dependencies.directory.listByOrg(actor.orgId, kind);
    },

    listOfClient: async (actor: ActorContext, clientId: string) => {
      assertCan(actor, "read");
      if (!(await dependencies.clients.reachableClientIds(actor)).includes(clientId)) {
        throw new AppError("not-found", "Client not found");
      }
      return dependencies.directory.listByClient(actor.orgId, clientId);
    },

    avatar: async (actor: ActorContext, id: string): Promise<Uint8Array> => {
      assertCan(actor, "read");
      const member = await reachable(actor, id);
      const bytes = await dependencies.avatars.readAvatar(member.userId);
      if (!bytes) throw new AppError("not-found", "Member has no picture");
      return bytes;
    },

    update: async (actor: ActorContext, id: string, change: MemberChange) => {
      assertCan(actor, "update");
      const member = await reachable(actor, id);
      await assertNotTheLastAdmin(member, change);
      return dependencies.unitOfWork.run((context) =>
        dependencies.directory.update(context, id, change),
      );
    },

    remove: async (actor: ActorContext, id: string) => {
      assertCan(actor, "delete");
      if (id === actor.membershipId) {
        throw new AppError("conflict", "You cannot remove your own membership");
      }
      const member = await reachable(actor, id);
      await assertNotTheLastAdmin(member, { status: "SUSPENDED" });
      await dependencies.unitOfWork.run((context) =>
        dependencies.directory.remove(context, id),
      );
    },

    accessOf: async (actor: ActorContext, id: string) => {
      assertCan(actor, "update");
      const member = await reachable(actor, id);
      return dependencies.access.listFor(member.id);
    },

    setAccess: async (actor: ActorContext, id: string, input: SetAccessInput) => {
      assertCan(actor, "update");
      const member = await reachable(actor, id);

      const clientIds = [...new Set(input.grants.map((grant) => grant.clientId))];
      const projects = await dependencies.access.projectsByClient(actor.orgId, clientIds);

      const seen = new Set<string>();
      const grants: AccessGrant[] = [];
      for (const grant of input.grants) {
        const clientProjects = projects.get(grant.clientId);
        if (!clientProjects) throw new AppError("validation", "Unknown client in grants");
        if (grant.projectId && !clientProjects.includes(grant.projectId)) {
          throw new AppError("validation", "Project does not belong to that client");
        }
        const key = `${grant.clientId}:${grant.projectId ?? ""}`;
        if (seen.has(key)) throw new AppError("validation", "Duplicate grant");
        seen.add(key);
        grants.push({ clientId: grant.clientId, projectId: grant.projectId ?? null });
      }

      await dependencies.unitOfWork.run((context) =>
        dependencies.access.replace(context, member.id, grants),
      );
      return dependencies.access.listFor(member.id);
    },

    describeSession: async (actor: ActorContext) => {
      const [user, organization, clientIds] = await Promise.all([
        dependencies.users.findById(actor.userId),
        dependencies.organizations.findById(actor.orgId),
        dependencies.clients.reachableClientIds(actor),
      ]);
      if (!user || !organization) {
        throw new AppError("not-found", "Session could not be resolved");
      }
      return { user, organization, role: actor.role, clientIds };
    },
  };
}

export type MemberUseCases = ReturnType<typeof createMemberUseCases>;
