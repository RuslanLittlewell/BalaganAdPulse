import type { Role } from "@adpulse/access-policy";
import type {
  ActorContext,
  TransactionContext,
  UnitOfWork,
} from "../../../shared/application/index.js";
import type { MemberChange, MemberRecord } from "../domain/member.js";

export interface MembershipDirectory {
  findActiveByUserId(userId: string): Promise<ActorContext | null>;
}

export interface MemberDependencies {
  readonly memberships: MembershipDirectory;
}

export interface OrganizationDirectory {
  findById(orgId: string): Promise<{ id: string; name: string; slug: string } | null>;
}

export interface SessionUserDirectory {
  findById(userId: string): Promise<{ id: string; name: string; email: string; image: string | null } | null>;
}

export interface ClientReachDirectory {
  reachableClientIds(actor: ActorContext): Promise<string[]>;
}

export interface SessionDependencies {
  readonly organizations: OrganizationDirectory;
  readonly users: SessionUserDirectory;
  readonly clients: ClientReachDirectory;
}

export const MEMBER_KINDS = ["staff"] as const;
export type MemberKind = (typeof MEMBER_KINDS)[number];

export interface MemberDirectory {
  listByOrg(orgId: string, kind?: MemberKind): Promise<MemberRecord[]>;
  listByClient(orgId: string, clientId: string): Promise<MemberRecord[]>;
  findInOrg(orgId: string, id: string): Promise<MemberRecord | null>;
  update(context: TransactionContext, id: string, change: MemberChange): Promise<MemberRecord>;
  remove(context: TransactionContext, id: string): Promise<void>;
  countOtherActiveAdmins(orgId: string, exceptId: string): Promise<number>;
}

export interface AccessGrant {
  readonly clientId: string;
  readonly projectId: string | null;
}

export interface AccessRepository {
  projectsByClient(orgId: string, clientIds: readonly string[]): Promise<Map<string, readonly string[]>>;
  replace(
    context: TransactionContext,
    membershipId: string,
    grants: readonly AccessGrant[],
  ): Promise<void>;
  listFor(membershipId: string): Promise<Array<AccessGrant & { membershipId: string }>>;
}

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
