import type { Role } from "@adpulse/access-policy";
import { can } from "@adpulse/access-policy";
import { AppError } from "../../../shared/domain/index.js";
import type { ActorContext, TransactionContext } from "../../../shared/application/index.js";
import {
  inviteStatus,
  isRedeemable,
  type Invite,
  type InviteStatus,
  type RegistrationType,
} from "../domain/invite.js";
import { InvitationCodeConflictError, type InviteDependencies } from "./ports.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;

/** Every rejected invitation answers with this, whatever was actually wrong
 * with it. Unknown, expired, revoked, already redeemed and addressed-to-someone
 * -else are indistinguishable from outside on purpose: registration is a public
 * endpoint, and a response that explained itself would let a stranger discover
 * which codes exist and which addresses were invited. */
export const INVALID_INVITE = "Invalid invite code";

export interface CreateInviteInput {
  readonly registrationType: RegistrationType;
  readonly role?: Role | null;
  readonly projectIds?: readonly string[];
  readonly email?: string | null;
  /** Absent means the invitation does not expire on its own. */
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

  return {
    create: async (actor: ActorContext, input: CreateInviteInput): Promise<InviteView> => {
      assertCan(actor, "create");
      const projectIds = [...new Set(input.projectIds ?? [])];
      if (input.registrationType === "CLIENT") {
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
              role: input.registrationType === "CLIENT" ? null : input.role!,
              projectIds: input.registrationType === "CLIENT" ? [] : projectIds,
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
      return invites.map(view);
    },

    resolve: async (code: string): Promise<{ registrationType: RegistrationType }> =>
      dependencies.unitOfWork.run(async (context) => {
        const invite = await dependencies.invites.findByCode(context, code);
        if (!invite || inviteStatus(invite, dependencies.clock.now()) !== "PENDING") {
          throw new AppError("not-found", INVALID_INVITE);
        }
        return { registrationType: invite.registrationType };
      }),

    /** Revoking is a timestamp rather than a delete: an invitation is the
     * record of how somebody was let in, and one already redeemed is history
     * that must not be rewritten — hence the conflict rather than a silent
     * no-op. */
    revoke: async (actor: ActorContext, id: string): Promise<void> => {
      assertCan(actor, "delete");
      const invite = await dependencies.invites.findInOrg(actor.orgId, id);
      if (!invite) throw new AppError("not-found", "Invite not found");
      if (invite.usedAt) throw new AppError("conflict", "This invite has already been used");
      await dependencies.unitOfWork.run((context) =>
        dependencies.invites.revoke(context, id, dependencies.clock.now()),
      );
    },

    /**
     * Redeeming happens inside the registration's transaction, so the account,
     * the membership and the claim commit together or not at all.
     *
     * The read and the claim are separate on purpose: two registrations can
     * both pass the read with the same code, and only the one whose conditional
     * claim still matches an unspent row may go on.
     */
    redeem: async (
      context: TransactionContext,
      code: string,
      email: string,
      userId: string,
      now: Date,
    ): Promise<void> => {
      const invite = await dependencies.invites.findByCode(context, code);
      if (!isRedeemable(invite, email, now)) throw new AppError("forbidden", INVALID_INVITE);
      if (invite.registrationType !== "EMPLOYEE" || !invite.role || invite.role === "CLIENT") {
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
