import type { Role } from "@adpulse/access-policy";
import type {
  ActorContext,
  TransactionContext,
  UnitOfWork,
} from "../../../shared/application/index.js";
import type { MemberChange, MemberRecord } from "../domain/member.js";

/** Where a person's current place in an organization is read from. Deliberately
 * one question: the middleware asks it on every request, so it must stay a
 * single indexed lookup rather than a general membership query surface. */
export interface MembershipDirectory {
  findActiveByUserId(userId: string): Promise<ActorContext | null>;
}

export interface MemberDependencies {
  readonly memberships: MembershipDirectory;
}

/** The organization a member is acting in. */
export interface OrganizationDirectory {
  findById(orgId: string): Promise<{ id: string; name: string; slug: string } | null>;
}

/** The account behind the membership, for the parts of the session payload that
 * describe the person rather than their place in the organization. */
export interface SessionUserDirectory {
  findById(userId: string): Promise<{ id: string; name: string; email: string; image: string | null } | null>;
}

/** Which clients the actor can reach. Owned here because the session answer
 * needs it; the clients module supplies the implementation. */
export interface ClientReachDirectory {
  reachableClientIds(actor: ActorContext): Promise<string[]>;
}

export interface SessionDependencies {
  readonly organizations: OrganizationDirectory;
  readonly users: SessionUserDirectory;
  readonly clients: ClientReachDirectory;
}

export interface MemberDirectory {
  listByOrg(orgId: string): Promise<MemberRecord[]>;
  findInOrg(orgId: string, id: string): Promise<MemberRecord | null>;
  update(context: TransactionContext, id: string, change: MemberChange): Promise<MemberRecord>;
  remove(context: TransactionContext, id: string): Promise<void>;
  /** How many *other* memberships could still administer the organization. */
  countOtherActiveAdmins(orgId: string, exceptId: string): Promise<number>;
}

export interface AccessGrant {
  readonly clientId: string;
  readonly projectId: string | null;
}

export interface AccessRepository {
  /** For each of the given clients that exists in this organization, the ids of
   * the projects it holds. A client absent from the result does not belong
   * here — which is reported the same way as one that does not exist at all. */
  projectsByClient(orgId: string, clientIds: readonly string[]): Promise<Map<string, readonly string[]>>;
  replace(
    context: TransactionContext,
    membershipId: string,
    grants: readonly AccessGrant[],
  ): Promise<void>;
  listFor(membershipId: string): Promise<Array<AccessGrant & { membershipId: string }>>;
}

/**
 * A member's picture, by the account behind the membership.
 *
 * Raw bytes rather than a data URL: this is served as an image, and a member
 * list carries a marker only — the pictures themselves would make listing the
 * team as heavy as the number of people in it.
 */
export interface MemberAvatarStorage {
  readAvatar(userId: string): Promise<Uint8Array | null>;
}

export interface MemberManagementDependencies {
  readonly directory: MemberDirectory;
  readonly access: AccessRepository;
  readonly avatars: MemberAvatarStorage;
  readonly unitOfWork: UnitOfWork;
}

export type { Role };
