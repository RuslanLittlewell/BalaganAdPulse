import type { ActorContext, TransactionContext } from '#shared/application/index.js';
import type { Kpi, KpiOwner, NewProjectKpi, ProjectKpi } from '../domain/kpi.js';

export interface KpiRepository {
  read(owner: KpiOwner): Promise<Kpi | null>;
  write(context: TransactionContext, owner: KpiOwner, kpi: Kpi | null): Promise<void>;
}

export interface ProjectKpiRepository {
  list(projectId: string): Promise<ProjectKpi[]>;
  replace(context: TransactionContext, projectId: string, kpis: readonly NewProjectKpi[]): Promise<void>;
}

export interface ProjectKpiEvents {
  changed(projectId: string, actor: ActorContext): void;
}

export interface KpiReach {
  projects: { findReachable(actor: ActorContext, id: string): Promise<{ id: string; clientId: string } | null> };
  campaigns: { findReachable(actor: ActorContext, id: string): Promise<{ id: string; projectId: string } | null> };
}
