import { z } from "zod";
import { ROLES } from "@adpulse/access-policy";

/** Matched to the account address it will be compared against at registration,
 * which the identity schemas also trim and lowercase — otherwise an invitation
 * addressed to `Invited@Acme.com` could never be redeemed. */
const email = z.string().trim().toLowerCase().pipe(z.email("invalid email"));

export const createInviteSchema = z.object({
  role: z.enum(ROLES),
  email: email.nullable().optional(),
  /** Absent means the invitation does not expire on its own. */
  expiresInDays: z.number().int().positive().max(365).optional(),
});
