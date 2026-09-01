import type { ActorContext } from "../../../shared/application/index.js";
import type { SessionPrincipal } from "../../identity/index.js";

/** Resolving an authenticated identity into its place in an organization. The
 * members module owns this because the answer is a membership, not a login. */
export interface ActorResolutionPort {
  resolveActor(principal: SessionPrincipal): Promise<ActorContext>;
}
