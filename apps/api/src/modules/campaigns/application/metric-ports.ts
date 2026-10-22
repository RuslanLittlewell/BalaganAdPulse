import type { MeasuredDay } from "../domain/metrics.js";
import type { Channel } from "../domain/hierarchy.js";
import type { CampaignResultKind, TypedDay } from "../domain/result-type.js";

export interface CampaignDay extends MeasuredDay {
  readonly campaignId: string;
}

export interface CampaignChannel {
  readonly id: string;
  readonly channel: Channel;
}

export interface MetricRepository {
  readCampaignRange(campaignId: string, from: Date, to: Date): Promise<MeasuredDay[]>;
  readCampaignsRange(campaignIds: readonly string[], from: Date, to: Date): Promise<CampaignDay[]>;
  readAdSetRange(adSetId: string, from: Date, to: Date): Promise<MeasuredDay[]>;
  readTypedDays(campaigns: readonly CampaignChannel[], from: Date, to: Date): Promise<TypedDay[]>;
  readResultKinds(campaignIds: readonly string[]): Promise<CampaignResultKind[]>;
  readAdRange(adId: string, from: Date, to: Date): Promise<MeasuredDay[]>;
}
