export const CHANNELS = ["META", "GOOGLE", "YANDEX", "VK", "TIKTOK", "LINKEDIN", "TELEGRAM"] as const;

export type Channel = (typeof CHANNELS)[number];

export function isChannel(value: string): value is Channel {
  return (CHANNELS as readonly string[]).includes(value);
}

export const DELIVERY_STATUSES = ["ACTIVE", "LEARNING", "PAUSED", "REJECTED", "ENDED"] as const;

export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export function isDeliveryStatus(value: string): value is DeliveryStatus {
  return (DELIVERY_STATUSES as readonly string[]).includes(value);
}

export interface Campaign {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly channel: Channel;
  readonly status: DeliveryStatus;
  readonly objective: string | null;
  readonly externalId: string | null;
  readonly position: number;
}

export interface AdSet {
  readonly id: string;
  readonly campaignId: string;
  readonly name: string;
  readonly audience: string | null;
  readonly status: DeliveryStatus;
  readonly externalId: string | null;
  readonly position: number;
}

export interface Ad {
  readonly id: string;
  readonly adSetId: string;
  readonly name: string;
  readonly format: string | null;
  readonly headline: string | null;
  readonly status: DeliveryStatus;
  readonly externalId: string | null;
  readonly position: number;
}

export const CREATIVE_KINDS = ["IMAGE", "VIDEO"] as const;

export type CreativeKind = (typeof CREATIVE_KINDS)[number];

export interface Creative {
  readonly id: string;
  readonly position: number;
  readonly kind: CreativeKind;
  readonly title: string | null;
  readonly body: string | null;
  readonly hasFile: boolean;
  readonly hasPoster: boolean;
}

export interface CreativeFile {
  readonly body: Uint8Array;
  readonly contentType: string;
}

export interface DateRange {
  readonly from: Date;
  readonly to: Date;
}

export function isOrderedRange(range: DateRange): boolean {
  return range.from.getTime() <= range.to.getTime();
}
