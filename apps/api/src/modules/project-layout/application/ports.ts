import type { ActorContext, TransactionContext } from "#shared/application/index.js";
import type { GroupRecord, StoredLayout } from "../domain/layout.js";

export interface ProjectLayoutRepository {
  read(membershipId: string): Promise<StoredLayout>;
  replace(
    context: TransactionContext,
    membershipId: string,
    layout: StoredLayout,
  ): Promise<void>;
  createGroup(
    context: TransactionContext,
    input: { id: string; membershipId: string; name: string; position: number },
  ): Promise<GroupRecord>;
  deleteGroup(context: TransactionContext, membershipId: string, groupId: string): Promise<void>;
}

export interface ProjectReach {
  reachableIds(actor: ActorContext): Promise<readonly string[]>;
}
