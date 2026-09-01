import type { Role } from "@adpulse/access-policy";
import { can } from "@adpulse/access-policy";
import { AppError } from "../../../shared/domain/index.js";
import type { ActorContext, TransactionContext } from "../../../shared/application/index.js";
import { inviteStatus, isRedeemable, type Invite, type InviteStatus } from "../domain/invite.js";
import type { InviteDependencies } from "./ports.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Every rejected invitation answers with this, whatever was actually wrong
 * with it. Unknown, expired, revoked, already redeemed and addressed-to-someone
 * -else are indistinguishable from outside on purpose: registration is a public
 * endpoint, and a response that explained itself would let a stranger discover
 * which codes exist and which addresses were invited. */
export const INVALID_INVITE = "Invalid invite code";

export interface CreateInviteInput {
  readonly role: Role;
  readonly email?: string | null;
  /** Absent means the invitation does not expire on its own. */
  readonly expiresInDays?: number;
}

export interface InviteView extends Invite {
  readonly status: InviteStatus;
}

export function createInviteUseCases(dependencies: InviteDependencies) {
  const view = (invite: Invite): InviteView => ({
    ...invite,
    status: inviteStatus(invite, dependencies.clock.now()),
  });

  const assertCan = (actor: ActorContext, action: "read" | "create" | "delete") => {
    if (!can(actor, action, "invite")) {
      throw new AppError("forbidden", `Your role may not ${action} a invite`);
    }
  };

  return {
    create: async (actor: ActorContext, input: CreateInviteInput): Promise<InviteView> => {
      assertCan(actor, "create");
      const now = dependencies.clock.now();
      return dependencies.unitOfWork.run(async (context) => {
        const invite = await dependencies.invites.create(context, {
          id: dependencies.ids.generate(),
          orgId: actor.orgId,
          // The code is the whole secret, so it is sized like one rather than
          // made pronounceable: guessing is the only attack on an invitation.
          code: dependencies.ids.generate(),
          role: input.role,
          email: input.email ?? null,
          expiresAt: input.expiresInDays
            ? new Date(now.getTime() + input.expiresInDays * MS_PER_DAY)
            : null,
          createdById: actor.membershipId,
        });
        return view(invite);
      });
    },

    list: async (actor: ActorContext): Promise<InviteView[]> => {
      assertCan(actor, "read");
      const invites = await dependencies.invites.listByOrg(actor.orgId);
      return invites.map(view);
    },

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
      await dependencies.memberships.enrol(context, {
        userId,
        orgId: invite.orgId,
        role: invite.role,
      });
      const claimed = await dependencies.invites.claim(context, invite.id, userId, now);
      if (!claimed) throw new AppError("forbidden", INVALID_INVITE);
    },
  };
}

export type InviteUseCases = ReturnType<typeof createInviteUseCases>;
