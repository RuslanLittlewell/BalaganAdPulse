export const SEND_STATUSES = ['WAITING_AMOUNT', 'PENDING', 'SENT', 'FAILED', 'EXPIRED'] as const;
export type SendStatus = (typeof SEND_STATUSES)[number];

export const DATASET_STATES = ['ACTIVE', 'AUTH_REQUIRED'] as const;
export type DatasetState = (typeof DATASET_STATES)[number];

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const AMOUNT_HOLD_MS = 72 * HOUR;
export const EVENT_AGE_LIMIT_MS = 7 * DAY;
export const EXPIRY_MARGIN_MS = 5 * MINUTE;
export const CATCH_UP_MS = 7 * DAY;
export const SEND_BATCH = 100;
export const RECENT_SENDS = 20;
export const EXPIRED_REASON = 'Older than the seven days Meta accepts';

const RETRY_STEPS_MS = [MINUTE, 5 * MINUTE, 15 * MINUTE, HOUR];
const RETRY_LATER_MS = 3 * HOUR;

export function retryDelay(attempts: number): number {
  return RETRY_STEPS_MS[attempts] ?? RETRY_LATER_MS;
}

export function expiryCutoff(now: Date): Date {
  return new Date(now.getTime() - EVENT_AGE_LIMIT_MS + EXPIRY_MARGIN_MS);
}

export function phoneForMatching(phoneDigits: string | null): string | null {
  const digits = phoneDigits?.replace(/\D/g, '') ?? '';
  return digits.length > 0 ? digits : null;
}

export function emailForMatching(email: string | null): string | null {
  const normalized = email?.trim().toLowerCase() ?? '';
  return normalized.length > 0 ? normalized : null;
}

export function positiveAmount(amount: string | null): number | null {
  if (amount === null) return null;
  const value = Number(amount);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export interface DatasetView {
  datasetId: string;
  datasetName: string;
  testEventCode: string | null;
  currency: string;
  state: DatasetState;
  lastError: string | null;
  lastSentAt: Date | null;
}

export interface StoredDataset extends DatasetView {
  projectId: string;
  orgId: string;
  encryptedToken: string;
  revision: string;
}

export interface DatasetJob {
  projectId: string;
  datasetId: string;
  encryptedToken: string;
  testEventCode: string | null;
  currency: string;
  revision: string;
  leaseOwner: string;
}

export interface DueSend {
  id: string;
  leadId: string;
  eventName: string;
  reachedAt: Date;
  carriesAmount: boolean;
  metaLeadId: string;
  phoneDigits: string | null;
  email: string | null;
  amount: string | null;
}

export interface OutgoingEvent {
  id: string;
  eventName: string;
  eventTime: Date;
  metaLeadId: string;
  leadId: string;
  phone: string | null;
  email: string | null;
  value: number | null;
  currency: string | null;
}

export interface DeliveryCounts {
  today: number;
  week: number;
  month: number;
}

export interface RecentSend {
  id: string;
  leadId: string;
  leadName: string;
  eventName: string;
  reachedAt: Date;
  status: SendStatus;
  lastError: string | null;
  sentAt: Date | null;
}

export type ConversionsApiFailure = 'AUTH' | 'REFUSED' | 'TEMPORARY';

export class ConversionsApiError extends Error {
  constructor(readonly kind: ConversionsApiFailure, readonly reason = '', readonly detail = '') {
    super(`Meta Conversions API: ${kind}`);
  }
}

export function outgoingEvent(send: DueSend, currency: string): OutgoingEvent {
  const value = send.carriesAmount ? positiveAmount(send.amount) : null;
  return {
    id: send.id,
    eventName: send.eventName,
    eventTime: send.reachedAt,
    metaLeadId: send.metaLeadId,
    leadId: send.leadId,
    phone: phoneForMatching(send.phoneDigits),
    email: emailForMatching(send.email),
    value,
    currency: value === null ? null : currency,
  };
}
