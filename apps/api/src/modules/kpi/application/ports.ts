import type { ActorContext, TransactionContext } from '#shared/application/index.js';
import type { Kpi, KpiOwner } from '../domain/kpi.js';

export interface KpiRepository {
  read(owner: KpiOwner): Promise<Kpi | null>;
  write(context: TransactionContext, owner: KpiOwner, kpi: Kpi | null): Promise<void>;
}

export interface KpiReach {
  projects: { findReachable(actor: ActorContext, id: string): Promise<{ id: string; clientId: string } | null> };
  campaigns: { findReachable(actor: ActorContext, id: string): Promise<{ id: string; projectId: string } | null> };
}
