import type { MeasuredDay } from "../domain/metrics.js";

export interface MetricRepository {
  readCampaignRange(campaignId: string, from: Date, to: Date): Promise<MeasuredDay[]>;
  readAdSetRange(adSetId: string, from: Date, to: Date): Promise<MeasuredDay[]>;
  readAdRange(adId: string, from: Date, to: Date): Promise<MeasuredDay[]>;
}
