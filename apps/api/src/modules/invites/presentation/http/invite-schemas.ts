import { z } from "zod";

const email = z.string().trim().toLowerCase().pipe(z.email("invalid email"));

const common = {
  email: email.nullable().optional(),
  expiresInDays: z.number().int().positive().max(365).optional(),
};

export const createInviteSchema = z.discriminatedUnion("registrationType", [
  z.object({ registrationType: z.literal("CLIENT"), ...common }).strict(),
  z.object({
    registrationType: z.literal("CLIENT_STAFF"),
    clientId: z.uuid(),
    ...common,
  }).strict(),
  z.object({
    registrationType: z.literal("EMPLOYEE"),
    role: z.enum(["ADMIN", "MANAGER", "GUEST"]),
    projectIds: z.array(z.uuid()).min(1),
    ...common,
  }).strict(),
]);

export const listInvitesQuerySchema = z.object({
  registrationType: z.enum(["CLIENT", "EMPLOYEE", "CLIENT_STAFF"]).optional(),
});

export const resolveInviteParamsSchema = z.object({
  code: z.string().length(8).regex(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]+$/),
});
