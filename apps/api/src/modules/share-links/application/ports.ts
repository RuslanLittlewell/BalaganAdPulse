import type { OptionalModule } from "@adpulse/access-policy";
import type { ActorContext, TransactionContext } from "#shared/application/index.js";
import type { LiveShareLink, ShareLink } from "../domain/share-link.js";

export interface ShareLinkRepository {
  find(projectId: string, context?: TransactionContext): Promise<ShareLink | null>;
  create(
    context: TransactionContext,
    input: { id: string; projectId: string; token: string; createdById: string },
  ): Promise<ShareLink>;
  renew(context: TransactionContext, projectId: string, token: string): Promise<ShareLink>;
  remove(context: TransactionContext, projectId: string): Promise<void>;
  findLive(token: string): Promise<LiveShareLink | null>;
}

export interface ShareTokenSource {
  issue(): string;
}

export interface ShareProjectReach {
  findReachable(actor: ActorContext, id: string): Promise<{ id: string; clientId: string; name: string } | null>;
}

export interface SharedProjectReader {
  read(actor: ActorContext, id: string): Promise<{ id: string; name: string }>;
}

export interface ModuleEntitlements {
  isEntitled(actor: ActorContext, module: OptionalModule): Promise<boolean>;
}
