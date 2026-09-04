import type { Role } from "@adpulse/access-policy";
import { can } from "@adpulse/access-policy";
import { AppError } from "#shared/domain/index.js";
import type { ActorContext, TransactionContext } from "#shared/application/index.js";
import {
  inviteStatus,
  isRedeemable,
  type Invite,
  type InviteStatus,
  type RegistrationType,
} from "../domain/invite.js";
import {
  InvitationCodeConflictError,
  type ClientRegistrationDetails,
  type InviteDependencies,
} from "./ports.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;

export const INVALID_INVITE = "Invalid invite code";

export interface CreateInviteInput {
  readonly registrationType: RegistrationType;
  readonly role?: Role | null;
  readonly projectIds?: readonly string[];
  readonly clientId?: string;
  readonly email?: string | null;
  readonly expiresInDays?: number;
}

export interface InviteView extends Invite {
  readonly status: InviteStatus;
  readonly registrationUrl: string;
}

export function createInviteUseCases(dependencies: InviteDependencies) {
  const view = (invite: Invite): InviteView => ({
    ...invite,
    status: inviteStatus(invite, dependencies.clock.now()),
    registrationUrl: `/regustration/${invite.code}`,
  });

  const assertCan = (actor: ActorContext, action: "read" | "create" | "delete") => {
    if (!can(actor, action, "invite")) {
      throw new AppError("forbidden", `Your role may not ${action} a invite`);
    }
  };

  const reaches = async (actor: ActorContext, invite: Invite): Promise<boolean> => {
    if (actor.role === "ADMIN") return true;
    if (!invite.clientId) return false;
    return dependencies.clients.isReachable(actor, invite.clientId);
  };

  const onlyReachable = async (actor: ActorContext, invites: Invite[]): Promise<Invite[]> => {
    if (actor.role === "ADMIN") return invites;
    const verdicts = await Promise.all(invites.map((invite) => reaches(actor, invite)));
    return invites.filter((_invite, index) => verdicts[index]);
  };

  return {
    create: async (actor: ActorContext, input: CreateInviteInput): Promise<InviteView> => {
      assertCan(actor, "create");
      const projectIds = [...new Set(input.projectIds ?? [])];
      if (input.registrationType === "CLIENT_STAFF") {
        if (input.role !== undefined && input.role !== null || projectIds.length > 0) {
          throw new AppError(
            "validation", "An invitation to join a client carries no role or projects",
          );
        }
        if (!input.clientId) {
          throw new AppError("validation", "An invitation to join a client must name one");
        }
        if (!(await dependencies.clients.isReachable(actor, input.clientId))) {
          throw new AppError("not-found", "Client not found");
        }
      } else if (input.clientId) {
        throw new AppError("validation", "Only an invitation to join a client names one");
      } else if (input.registrationType === "CLIENT") {
        if (input.role !== undefined && input.role !== null || projectIds.length > 0) {
          throw new AppError("validation", "Client invitations cannot include role or projects");
        }
      } else {
        if (!input.role || input.role === "CLIENT") {
          throw new AppError("validation", "Employee invitation role is invalid");
        }
        if (projectIds.length === 0) {
          throw new AppError("validation", "Employee invitations require at least one project");
        }
        if (!(await dependencies.projects.allBelongToOrg(actor.orgId, projectIds))) {
          throw new AppError("validation", "One or more invitation projects are invalid");
        }
        if (input.role === "ADMIN" && actor.role !== "ADMIN") {
          throw new AppError("forbidden", "Only an admin may grant the admin role");
        }
      }
      const now = dependencies.clock.now();
      for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
        try {
          return await dependencies.unitOfWork.run(async (context) => {
            const invite = await dependencies.invites.create(context, {
              id: dependencies.ids.generate(),
              orgId: actor.orgId,
              code: dependencies.codes.generate(),
              registrationType: input.registrationType,
              role: input.registrationType === "EMPLOYEE" ? input.role! : null,
              projectIds: input.registrationType === "EMPLOYEE" ? projectIds : [],
              clientId: input.clientId ?? null,
              email: input.email ?? null,
              expiresAt: input.expiresInDays
                ? new Date(now.getTime() + input.expiresInDays * MS_PER_DAY)
                : null,
              createdById: actor.membershipId,
            });
            return view(invite);
          });
        } catch (error) {
          if (!(error instanceof InvitationCodeConflictError)) throw error;
        }
      }
      throw new Error("Unable to generate a unique invitation code");
    },

    list: async (actor: ActorContext, registrationType?: RegistrationType): Promise<InviteView[]> => {
      assertCan(actor, "read");
      const invites = await dependencies.invites.listPendingByOrg(
        actor.orgId,
        dependencies.clock.now(),
        registrationType,
      );
      return (await onlyReachable(actor, invites)).map(view);
    },

    resolve: async (code: string): Promise<{ registrationType: RegistrationType }> =>
      dependencies.unitOfWork.run(async (context) => {
        const invite = await dependencies.invites.findByCode(context, code);
        if (!invite || inviteStatus(invite, dependencies.clock.now()) !== "PENDING") {
          throw new AppError("not-found", INVALID_INVITE);
        }
        return { registrationType: invite.registrationType };
      }),

    revoke: async (actor: ActorContext, id: string): Promise<void> => {
      assertCan(actor, "delete");
      const invite = await dependencies.invites.findInOrg(actor.orgId, id);
      if (!invite || !(await reaches(actor, invite))) {
        throw new AppError("not-found", "Invite not found");
      }
      if (invite.usedAt) throw new AppError("conflict", "This invite has already been used");
      await dependencies.unitOfWork.run((context) =>
        dependencies.invites.revoke(context, id, dependencies.clock.now()),
      );
    },

    redeem: async (
      context: TransactionContext,
      code: string,
      email: string,
      userId: string,
      now: Date,
      details?: ClientRegistrationDetails,
    ): Promise<void> => {
      const invite = await dependencies.invites.findByCode(context, code);
      if (!isRedeemable(invite, email, now)) throw new AppError("forbidden", INVALID_INVITE);

      if (invite.registrationType === "CLIENT_STAFF") {
        if (details) {
          throw new AppError(
            "validation", "Joining a client carries no contact or project of its own",
          );
        }
        if (!invite.clientId) throw new AppError("forbidden", INVALID_INVITE);
        const membershipId = await dependencies.memberships.enrol(context, {
          userId, orgId: invite.orgId, role: "CLIENT",
        });
        await dependencies.projectAccess.grant(
          context, membershipId, await dependencies.clientProjects.projectIdsOf(invite.clientId),
        );
        const spent = await dependencies.invites.claim(context, invite.id, userId, now);
        if (!spent) throw new AppError("forbidden", INVALID_INVITE);
        return;
      }

      if (invite.registrationType === "CLIENT") {
        if (!details) {
          throw new AppError("validation", "Client registration needs a contact and a project");
        }
        const clientId = await dependencies.clientDirectory.create(context, {
          ...details.client, orgId: invite.orgId,
        });
        const projectId = await dependencies.projectDirectory.create(context, {
          ...details.project, clientId,
        });
        const membershipId = await dependencies.memberships.enrol(context, {
          userId, orgId: invite.orgId, role: "CLIENT",
        });
        await dependencies.projectAccess.grant(context, membershipId, [projectId]);
        const spent = await dependencies.invites.claim(context, invite.id, userId, now);
        if (!spent) throw new AppError("forbidden", INVALID_INVITE);
        return;
      }

      if (details) {
        throw new AppError("validation", "An employee registration carries no client details");
      }
      if (!invite.role || invite.role === "CLIENT") {
        throw new AppError("forbidden", INVALID_INVITE);
      }
      const membershipId = await dependencies.memberships.enrol(context, {
        userId,
        orgId: invite.orgId,
        role: invite.role,
      });
      await dependencies.projectAccess.grant(context, membershipId, invite.projectIds);
      const claimed = await dependencies.invites.claim(context, invite.id, userId, now);
      if (!claimed) throw new AppError("forbidden", INVALID_INVITE);
    },
  };
}

export type InviteUseCases = ReturnType<typeof createInviteUseCases>;
