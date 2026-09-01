import type { Role } from "@adpulse/access-policy";
import type { Clock, IdGenerator, TransactionContext, UnitOfWork } from "../../../shared/application/index.js";
import type { Invite, RegistrationType } from "../domain/invite.js";

export interface NewInvite {
  readonly id: string;
  readonly orgId: string;
  readonly code: string;
  readonly registrationType?: RegistrationType;
  readonly role: Role | null;
  readonly projectIds?: readonly string[];
  readonly email: string | null;
  readonly expiresAt: Date | null;
  readonly createdById: string | null;
}

export interface InviteRepository {
  create(context: TransactionContext, input: NewInvite): Promise<Invite>;
  listByOrg(orgId: string): Promise<Invite[]>;
  listPendingByOrg(orgId: string, now: Date, type?: RegistrationType): Promise<Invite[]>;
  findInOrg(orgId: string, id: string): Promise<Invite | null>;
  findByCode(context: TransactionContext, code: string): Promise<Invite | null>;
  revoke(context: TransactionContext, id: string, at: Date): Promise<void>;
  /** Conditional single-use claim. Answers false when the invitation was
   * already spent, which is how a race between two registrations is settled. */
  claim(context: TransactionContext, id: string, userId: string, at: Date): Promise<boolean>;
}

export interface InvitationCodeGenerator {
  generate(): string;
}

export class InvitationCodeConflictError extends Error {
  constructor() {
    super("Invitation code already exists");
    this.name = "InvitationCodeConflictError";
  }
}

/** Adding somebody to an organization. Owned here because redemption needs it,
 * implemented by the members module — invitations do not write memberships
 * themselves. */
export interface MembershipEnrolment {
  enrol(
    context: TransactionContext,
    value: { userId: string; orgId: string; role: Role },
  ): Promise<string>;
}

export interface InvitationProjectReach {
  allBelongToOrg(orgId: string, projectIds: readonly string[]): Promise<boolean>;
}

export interface InvitationProjectAccess {
  grant(
    context: TransactionContext,
    membershipId: string,
    projectIds: readonly string[],
  ): Promise<void>;
}

export interface InviteDependencies {
  readonly invites: InviteRepository;
  readonly memberships: MembershipEnrolment;
  readonly projects: InvitationProjectReach;
  readonly projectAccess: InvitationProjectAccess;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly codes: InvitationCodeGenerator;
  readonly unitOfWork: UnitOfWork;
}
