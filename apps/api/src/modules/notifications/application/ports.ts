import type { Clock } from "#shared/application/index.js";
import type { IsoDateRange, KpiFigures, KpiInput } from "#modules/kpi/index.js";
import type { AddressedNotification, NewNotification, NotificationView } from "../domain/notification.js";
import type { NotificationHub } from "./notification-hub.js";

export interface NotificationRepository {
  createMany(notifications: readonly NewNotification[]): Promise<AddressedNotification[]>;
  latest(recipientId: string, limit: number): Promise<NotificationView[]>;
  unreadCount(recipientId: string): Promise<number>;
  markRead(recipientId: string, id: string, at: Date): Promise<boolean>;
  markAllRead(recipientId: string, at: Date): Promise<void>;
}

export interface NotificationRecipients {
  staffReaching(projectId: string): Promise<string[]>;
  activeMembers(ids: readonly string[]): Promise<Array<{ id: string; customer: boolean }>>;
}

export interface ProjectKpiStandings {
  read(projectId: string, range: IsoDateRange): Promise<{ kpi: KpiInput; figures: KpiFigures } | null>;
}

export interface KpiMonthClaims {
  claim(projectId: string, month: string): Promise<boolean>;
}

export interface NotificationDependencies {
  readonly notifications: NotificationRepository;
  readonly recipients: NotificationRecipients;
  readonly standings: ProjectKpiStandings;
  readonly claims: KpiMonthClaims;
  readonly hub: NotificationHub;
  readonly clock: Clock;
}
