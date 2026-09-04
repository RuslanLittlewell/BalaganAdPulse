import type { Actor } from "@adpulse/access-policy";
import type { SessionPrincipal } from "../../modules/identity/domain/identity-user.js";

declare global {
  namespace Express {
    interface Request {
      user?: { id: string };
      principal?: SessionPrincipal;
      actor?: Actor;
      actorIdentity?: { name: string; email: string };
    }
  }
}

export {};
