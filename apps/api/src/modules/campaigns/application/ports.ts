import type { ActorContext } from "../../../shared/application/index.js";
import type { Ad, AdSet, Campaign } from "../domain/hierarchy.js";

export interface CampaignRepository {
  findReachable(actor: ActorContext, id: string): Promise<Campaign | null>;
  listReachableByProject(actor: ActorContext, projectId: string): Promise<Campaign[]>;
  listReachable(actor: ActorContext): Promise<Campaign[]>;
}

export interface AdSetRepository {
  listByCampaign(campaignId: string): Promise<AdSet[]>;
  findById(id: string): Promise<AdSet | null>;
}

export interface AdRepository {
  listByAdSet(adSetId: string): Promise<Ad[]>;
}

export interface ProjectReach {
  isReachable(actor: ActorContext, projectId: string): Promise<boolean>;
}
