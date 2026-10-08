import type { ActorContext, TransactionContext } from "#shared/application/index.js";
import type { Month } from "../domain/month.js";
import type { AdTotals, MonthTotals, ReportFigures, ReportRecord, ReportStatus } from "../domain/report.js";

export interface ReportProject {
  readonly id: string;
  readonly clientId: string;
  readonly budgetCurrency: string | null;
}

export interface ReportProjectReach {
  findReachable(actor: ActorContext, id: string): Promise<ReportProject | null>;
  listReachable(actor: ActorContext): Promise<ReportProject[]>;
}

export interface NewReport {
  readonly id: string;
  readonly projectId: string;
  readonly month: Month;
  readonly currency: string | null;
  readonly figures: ReportFigures;
  readonly computedAt: Date;
  readonly adIds: readonly string[];
  readonly createdById: string;
}

export interface ReportChange {
  readonly status?: ReportStatus;
  readonly publishedAt?: Date | null;
  readonly figures?: ReportFigures;
  readonly computedAt?: Date;
  readonly leadsOverride?: number | null;
  readonly messengerContacts?: number | null;
  readonly conclusions?: unknown;
  readonly plan?: unknown;
  readonly adIds?: readonly string[];
  readonly coverKey?: string | null;
  readonly coverContentType?: string | null;
}

export interface ReportRepository {
  list(projectId: string): Promise<ReportRecord[]>;
  find(projectId: string, id: string): Promise<ReportRecord | null>;
  findById(id: string): Promise<ReportRecord | null>;
  listForProjects(projectIds: readonly string[]): Promise<ReportRecord[]>;
  exists(projectId: string, month: Month): Promise<boolean>;
  corrections(projectId: string, months: readonly Month[]): Promise<Map<Month, number>>;
  create(context: TransactionContext, report: NewReport): Promise<ReportRecord>;
  update(context: TransactionContext, id: string, change: ReportChange): Promise<ReportRecord>;
  delete(context: TransactionContext, id: string): Promise<void>;
}

export interface ReportMetrics {
  timezones(projectId: string): Promise<string[]>;
  firstMonth(projectId: string): Promise<Month | null>;
  monthTotals(projectId: string, from: Month, to: Month): Promise<MonthTotals[]>;
  adTotals(projectId: string, month: Month): Promise<AdTotals[]>;
}

export interface ReportCoverStorage {
  write(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  read(key: string): Promise<{ body: Uint8Array; contentType: string } | null>;
  remove(key: string): Promise<void>;
}
