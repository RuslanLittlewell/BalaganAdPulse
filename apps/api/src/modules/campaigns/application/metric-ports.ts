import type { MeasuredDay } from "../domain/metrics.js";
import type { AdSetResults } from "../domain/result-type.js";

export interface CampaignDay extends MeasuredDay {
  readonly campaignId: string;
}

export interface MetricRepository {
  readCampaignRange(campaignId: string, from: Date, to: Date): Promise<MeasuredDay[]>;
  readCampaignsRange(campaignIds: readonly string[], from: Date, to: Date): Promise<CampaignDay[]>;
  readAdSetRange(adSetId: string, from: Date, to: Date): Promise<MeasuredDay[]>;
  readAdSetResults(campaignIds: readonly string[], from: Date, to: Date): Promise<AdSetResults[]>;
  readAdRange(adId: string, from: Date, to: Date): Promise<MeasuredDay[]>;
}
