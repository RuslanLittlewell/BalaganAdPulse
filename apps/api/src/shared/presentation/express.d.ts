import type { Actor } from "@adpulse/access-policy";
import type { SessionPrincipal } from "../../modules/identity/domain/identity-user.js";

declare global {
  namespace Express {
    interface Request {
      user?: { id: string };
      /** Set by the authentication middleware: who is calling, independent of
       * any organization they may belong to. */
      principal?: SessionPrincipal;
      /** Set by loadActor, so present on every route behind it. */
      actor?: Actor;
      /** Current database values used to snapshot the audit actor. */
      actorIdentity?: { name: string; email: string };
    }
  }
}

export {};
