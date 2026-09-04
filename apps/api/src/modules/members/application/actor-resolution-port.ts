import type { ActorContext } from "#shared/application/index.js";
import type { SessionPrincipal } from "../../identity/index.js";

export interface ActorResolutionPort {
  resolveActor(principal: SessionPrincipal): Promise<ActorContext>;
}
