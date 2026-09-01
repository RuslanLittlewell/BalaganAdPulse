import type { ActorContext } from "../../../shared/application/index.js";
import type { Ad, AdSet, Campaign } from "../domain/hierarchy.js";

/** Reach is translated here, from the actor's role and grants into a filter. */
export interface CampaignRepository {
  findReachable(actor: ActorContext, id: string): Promise<Campaign | null>;
  listReachableByProject(actor: ActorContext, projectId: string): Promise<Campaign[]>;
  /** Every campaign the actor reaches, whatever project it sits under. */
  listReachable(actor: ActorContext): Promise<Campaign[]>;
}

export interface AdSetRepository {
  listByCampaign(campaignId: string): Promise<AdSet[]>;
  findById(id: string): Promise<AdSet | null>;
}

export interface AdRepository {
  listByAdSet(adSetId: string): Promise<Ad[]>;
}

/** Whether the actor may look at this project at all. Owned here; the projects
 * module supplies the implementation. */
export interface ProjectReach {
  isReachable(actor: ActorContext, projectId: string): Promise<boolean>;
}
