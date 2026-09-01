import { can } from "@adpulse/access-policy";
import { AppError } from "../../../shared/domain/index.js";
import type { ActorContext } from "../../../shared/application/index.js";
import type { SessionPrincipal } from "../../identity/index.js";
import { wouldStopBeingAdmin } from "../domain/member.js";
import type { MemberChange } from "../domain/member.js";
import type {
  AccessGrant,
  MemberDependencies,
  MemberManagementDependencies,
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

  /** Scoped to the actor's organization, so a membership elsewhere answers
   * not-found rather than confirming that it exists. */
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
    /**
     * Turns an authenticated identity into the role and tenancy it is acting
     * under. Read fresh every time rather than cached against the token: a
     * demotion or a suspension has to take effect on the very next request.
     *
     * A user with no membership and one that is suspended are refused
     * identically — both are simply not a member right now, and distinguishing
     * them would tell a stranger whether an account exists here.
     */
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

    list: async (actor: ActorContext) => {
      assertCan(actor, "read");
      return dependencies.directory.listByOrg(actor.orgId);
    },

    update: async (actor: ActorContext, id: string, change: MemberChange) => {
      assertCan(actor, "update");
      const member = await reachable(actor, id);
      await assertNotTheLastAdmin(member, change);
      return dependencies.unitOfWork.run((context) =>
        dependencies.directory.update(context, id, change),
      );
    },

    /** Removes the membership, not the account. The person keeps their login
     * and loses this organization; their clients, projects and campaigns stay
     * where they are, because they belong to the organization rather than to
     * them. */
    remove: async (actor: ActorContext, id: string) => {
      assertCan(actor, "delete");
      const member = await reachable(actor, id);
      await assertNotTheLastAdmin(member, { status: "SUSPENDED" });
      await dependencies.unitOfWork.run((context) =>
        dependencies.directory.remove(context, id),
      );
    },

    /**
     * Replaces a member's grants wholesale rather than adding to them, so the
     * request describes the state the admin wants rather than a diff — two
     * admins editing the same member cannot then interleave into a set neither
     * chose.
     *
     * Validated before anything is written, so a rejected set leaves the
     * member's existing reach exactly as it was.
     */
    setAccess: async (actor: ActorContext, id: string, input: SetAccessInput) => {
      assertCan(actor, "update");
      const member = await reachable(actor, id);

      const clientIds = [...new Set(input.grants.map((grant) => grant.clientId))];
      const projects = await dependencies.access.projectsByClient(actor.orgId, clientIds);

      const seen = new Set<string>();
      const grants: AccessGrant[] = [];
      for (const grant of input.grants) {
        const clientProjects = projects.get(grant.clientId);
        // A client outside the organization is reported the same way as one
        // that does not exist: an admin here has no business learning that an
        // id belongs to another agency.
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

    /**
     * Everything the web app needs to decide what to render, in one call: who
     * the caller is, which organization they are in, the role they hold right
     * now, and which clients they can reach. The role comes from the actor
     * resolved this request, so a demotion shows up here immediately.
     */
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
