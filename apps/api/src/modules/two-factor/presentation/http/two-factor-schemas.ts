import { z } from "zod";

const code = z.string().trim().min(6, "code is required").max(20);

export const codeSchema = z.object({ code }).strict();
export const challengeSchema = z.object({ challenge: z.string().min(1).max(200), code }).strict();
export const requirementSchema = z.object({ required: z.boolean() }).strict();
export const platformResetSchema = z.object({ email: z.string().trim().toLowerCase().pipe(z.email("invalid email")) }).strict();

export const statusSchema = z.object({ enabled: z.boolean(), required: z.boolean(), backupCodesLeft: z.number().int() });
export const setupSchema = z.object({ key: z.string(), uri: z.string(), qrSvg: z.string() });
export const backupCodesSchema = z.object({ backupCodes: z.array(z.string()) });
export const addressSchema = z.object({ id: z.string(), address: z.string(), confirmedAt: z.string(), lastUsedAt: z.string() });
export const organizationSchema = z.object({ required: z.boolean(), enrolledMembershipIds: z.array(z.string()) });
