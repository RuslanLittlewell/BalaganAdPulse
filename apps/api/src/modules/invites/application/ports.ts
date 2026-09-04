import type { Role } from "@adpulse/access-policy";
import type { ActorContext } from "#shared/application/index.js";
import type { Clock, IdGenerator, TransactionContext, UnitOfWork } from "#shared/application/index.js";
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

export interface MembershipEnrolment {
  enrol(
    context: TransactionContext,
    value: { userId: string; orgId: string; role: Role },
  ): Promise<string>;
}

export interface InvitationClientReach {
  isReachable(actor: ActorContext, clientId: string): Promise<boolean>;
}

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
    readonly budgetCurrency?: string;
  };
}

export interface ClientDirectory {
  create(
    context: TransactionContext,
    input: ClientRegistrationDetails["client"] & { orgId: string },
  ): Promise<string>;
}

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
