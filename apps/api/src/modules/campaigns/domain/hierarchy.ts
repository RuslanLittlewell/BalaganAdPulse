/** Where a campaign runs. The channel decides which connector fills its
 * figures, so it is the one thing a campaign cannot be without. */
export const CHANNELS = ["META", "GOOGLE", "YANDEX", "VK", "TIKTOK", "LINKEDIN", "TELEGRAM"] as const;

export type Channel = (typeof CHANNELS)[number];

export function isChannel(value: string): value is Channel {
  return (CHANNELS as readonly string[]).includes(value);
}

/** How the platform says delivery is going. One vocabulary for all three
 * levels: the platforms report the same states at each. */
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
  /** The platform's own identifier, so a figure can be traced to its account. */
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

/**
 * The days a reading covers, both endpoints included.
 *
 * A range names two days and means both of them: "1st to 5th" is five days, not
 * four. Half-open would be defensible for timestamps, but these are calendar
 * dates a media buyer picked, and they mean what they say.
 */
export interface DateRange {
  readonly from: Date;
  readonly to: Date;
}

export function isOrderedRange(range: DateRange): boolean {
  return range.from.getTime() <= range.to.getTime();
}
