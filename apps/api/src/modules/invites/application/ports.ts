import type { Role } from "@adpulse/access-policy";
import type { ActorContext } from "../../../shared/application/index.js";
import type { Clock, IdGenerator, TransactionContext, UnitOfWork } from "../../../shared/application/index.js";
import type { Invite, RegistrationType } from "../domain/invite.js";

export interface NewInvite {
  readonly id: string;
  readonly orgId: string;
  readonly code: string;
  readonly registrationType?: RegistrationType;
  readonly role: Role | null;
  readonly projectIds?: readonly string[];
  readonly clientId?: string | null;
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

/**
 * Whether the issuer may invite somebody to this client.
 *
 * One question rather than two — "does it exist" and "may they" are answered
 * together on purpose, so a principal naming another customer's client gets the
 * same answer an unknown id gets and cannot count what else is there.
 */
export interface InvitationClientReach {
  isReachable(actor: ActorContext, clientId: string): Promise<boolean>;
}

/** The projects a client has, so somebody joining it reaches the same work its
 * other people reach. Owned here, implemented by the projects module. */
export interface InvitationClientProjects {
  projectIdsOf(clientId: string): Promise<string[]>;
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

/** The contact the client registers as, and the first project they create. Both
 * are written through the modules that own them; the invitation only knows that
 * redemption is not finished until they exist. */
export interface ClientRegistrationDetails {
  readonly client: {
    readonly name: string;
    readonly fullName?: string | null;
    readonly organization?: string | null;
    readonly unp?: string | null;
    readonly phone?: string | null;
    readonly telegram?: string | null;
    readonly email?: string | null;
    readonly website?: string | null;
  };
  readonly project: {
    readonly name: string;
    readonly niche?: string | null;
    readonly monthlyBudget?: number | null;
    /** Loose on purpose: the invitations module has no opinion about which
     * currencies exist. The registration schema checks it against the list the
     * projects module owns, and the composition root narrows it there. */
    readonly budgetCurrency?: string;
  };
}

/** Owned here, implemented by the clients module. */
export interface ClientDirectory {
  create(
    context: TransactionContext,
    input: ClientRegistrationDetails["client"] & { orgId: string },
  ): Promise<string>;
}

/** Owned here, implemented by the projects module. */
export interface ProjectDirectory {
  create(
    context: TransactionContext,
    input: ClientRegistrationDetails["project"] & { clientId: string },
  ): Promise<string>;
}

export interface InviteDependencies {
  readonly invites: InviteRepository;
  readonly memberships: MembershipEnrolment;
  readonly projects: InvitationProjectReach;
  readonly clients: InvitationClientReach;
  readonly clientProjects: InvitationClientProjects;
  readonly projectAccess: InvitationProjectAccess;
  readonly clientDirectory: ClientDirectory;
  readonly projectDirectory: ProjectDirectory;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly codes: InvitationCodeGenerator;
  readonly unitOfWork: UnitOfWork;
}
