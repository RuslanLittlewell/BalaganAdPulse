import type { ActorContext, TransactionContext } from "#shared/application/index.js";
import type { SummaryTile } from "../domain/summary-tiles.js";

export interface SummaryTileRepository {
  readDashboard(membershipId: string): Promise<SummaryTile[]>;
  writeDashboard(context: TransactionContext, membershipId: string, tiles: readonly SummaryTile[]): Promise<void>;
  readProject(projectId: string): Promise<SummaryTile[]>;
  writeProject(context: TransactionContext, projectId: string, tiles: readonly SummaryTile[]): Promise<void>;
}

export interface SummaryProjectReach {
  findReachable(actor: ActorContext, id: string): Promise<{ id: string; clientId: string; name: string } | null>;
}
