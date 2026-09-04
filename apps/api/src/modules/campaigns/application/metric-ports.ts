import type { Measured, MeasuredDay } from "../domain/metrics.js";

export interface MetricRepository {
  recordCampaignDay(campaignId: string, date: Date, measured: Measured): Promise<void>;
  recordAdSetDay(adSetId: string, date: Date, measured: Measured): Promise<void>;
  recordAdDay(adId: string, date: Date, measured: Measured): Promise<void>;

  readCampaignRange(campaignId: string, from: Date, to: Date): Promise<MeasuredDay[]>;
  readAdSetRange(adSetId: string, from: Date, to: Date): Promise<MeasuredDay[]>;
  readAdRange(adId: string, from: Date, to: Date): Promise<MeasuredDay[]>;
}
