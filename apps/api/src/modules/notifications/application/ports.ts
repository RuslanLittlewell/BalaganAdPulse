import type { Clock } from "#shared/application/index.js";
import type { IsoDateRange, KpiFigures, KpiInput } from "#modules/kpi/index.js";
import type { AddressedNotification, NewNotification, NotificationView } from "../domain/notification.js";
import type { NotificationHub } from "./notification-hub.js";

export interface NotificationRepository {
  createMany(notifications: readonly NewNotification[]): Promise<AddressedNotification[]>;
  refreshUnread(notification: NewNotification, at: Date): Promise<AddressedNotification | null>;
  latest(recipientId: string, limit: number): Promise<NotificationView[]>;
  unreadCount(recipientId: string): Promise<number>;
  markRead(recipientId: string, id: string, at: Date): Promise<boolean>;
  markAllRead(recipientId: string, at: Date): Promise<void>;
}

export interface NotificationRecipients {
  staffReaching(projectId: string): Promise<string[]>;
  activeMembers(ids: readonly string[]): Promise<Array<{ id: string; customer: boolean }>>;
}

export interface MeasuredKpi {
  readonly kpi: KpiInput;
  readonly figures: KpiFigures;
}

export interface ProjectKpiStandings {
  read(projectId: string, range: IsoDateRange): Promise<MeasuredKpi[]>;
}

export interface KpiMonthClaims {
  claim(projectId: string, month: string): Promise<boolean>;
}

export interface DueTask {
  readonly id: string;
  readonly projectId: string | null;
  readonly dueDate: string;
  readonly dueTime: string | null;
  readonly participantIds: readonly string[];
  readonly createdById: string | null;
  readonly visibleToClient: boolean;
}

export interface DueTasks {
  dueBetween(fromDay: string, toDay: string): Promise<DueTask[]>;
  claim(taskId: string, deadline: Date): Promise<boolean>;
}

export interface NotificationRelay {
  forward(notifications: readonly AddressedNotification[]): void;
}

export interface NotificationDependencies {
  readonly notifications: NotificationRepository;
  readonly recipients: NotificationRecipients;
  readonly standings: ProjectKpiStandings;
  readonly claims: KpiMonthClaims;
  readonly dueTasks: DueTasks;
  readonly hub: NotificationHub;
  readonly relay: NotificationRelay;
  readonly clock: Clock;
  readonly timeZone: string;
}
