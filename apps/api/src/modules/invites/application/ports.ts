import type { Role } from "@adpulse/access-policy";
import type { Clock, IdGenerator, TransactionContext, UnitOfWork } from "../../../shared/application/index.js";
import type { Invite } from "../domain/invite.js";

export interface NewInvite {
  readonly id: string;
  readonly orgId: string;
  readonly code: string;
  readonly role: Role;
  readonly email: string | null;
  readonly expiresAt: Date | null;
  readonly createdById: string | null;
}

export interface InviteRepository {
  create(context: TransactionContext, input: NewInvite): Promise<Invite>;
  listByOrg(orgId: string): Promise<Invite[]>;
  findInOrg(orgId: string, id: string): Promise<Invite | null>;
  findByCode(context: TransactionContext, code: string): Promise<Invite | null>;
  revoke(context: TransactionContext, id: string, at: Date): Promise<void>;
  /** Conditional single-use claim. Answers false when the invitation was
   * already spent, which is how a race between two registrations is settled. */
  claim(context: TransactionContext, id: string, userId: string, at: Date): Promise<boolean>;
}

/** Adding somebody to an organization. Owned here because redemption needs it,
 * implemented by the members module — invitations do not write memberships
 * themselves. */
export interface MembershipEnrolment {
  enrol(
    context: TransactionContext,
    value: { userId: string; orgId: string; role: Role },
  ): Promise<void>;
}

export interface InviteDependencies {
  readonly invites: InviteRepository;
  readonly memberships: MembershipEnrolment;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly unitOfWork: UnitOfWork;
}
