import type { Measured, MeasuredDay } from "../domain/metrics.js";

/**
 * Reading and writing measured days.
 *
 * Deliberately three pairs rather than one pair with a level argument: each
 * level has its own table and its own foreign key, and a single generic method
 * would have to trust a string to pick between them.
 */
export interface MetricRepository {
  recordCampaignDay(campaignId: string, date: Date, measured: Measured): Promise<void>;
  recordAdSetDay(adSetId: string, date: Date, measured: Measured): Promise<void>;
  recordAdDay(adId: string, date: Date, measured: Measured): Promise<void>;

  /**
   * Every recorded day between the two dates, both endpoints included, oldest
   * first. The days carry their dates: a summary throws them away, but the
   * chart is the reason the endpoint exists.
   */
  readCampaignRange(campaignId: string, from: Date, to: Date): Promise<MeasuredDay[]>;
  readAdSetRange(adSetId: string, from: Date, to: Date): Promise<MeasuredDay[]>;
  readAdRange(adId: string, from: Date, to: Date): Promise<MeasuredDay[]>;
}
