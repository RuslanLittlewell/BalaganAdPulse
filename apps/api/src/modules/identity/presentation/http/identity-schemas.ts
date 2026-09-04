import { z } from "zod";
import { CURRENCIES } from "../../../projects/index.js";

const email = z.string().trim().toLowerCase().pipe(z.email("invalid email"));
const optionalText = z.string().trim().min(1).nullable().optional();

export const registerSchema = z.object({
  name: z.string().trim().min(1, "name is required"), email,
  password: z.string().min(8, "password must be at least 8 characters"),
  inviteCode: z.string().min(1, "inviteCode is required"),
  phone: optionalText,
  telegram: optionalText,
  client: z.object({
    name: z.string().trim().min(1, "client name is required"),
    fullName: optionalText,
    organization: optionalText,
    unp: optionalText,
    phone: optionalText,
    telegram: optionalText,
    email: optionalText,
    website: optionalText,
  }).optional(),
  project: z.object({
    name: z.string().trim().min(1, "project name is required"),
    niche: optionalText,
    monthlyBudget: z.number().nonnegative().nullable().optional(),
    budgetCurrency: z.enum(CURRENCIES).optional(),
  }).optional(),
}).refine(
  (value) => (value.client === undefined) === (value.project === undefined),
  { message: "A client registration needs both a contact and a project", path: ["project"] },
);
export const loginSchema = z.object({ email, password: z.string().min(1, "password is required") });
export const refreshSchema = z.object({ refreshToken: z.string().min(1, "refreshToken is required") });
export const updateProfileSchema = z.object({
  name: z.string().trim().min(1, "name is required"),
  phone: optionalText,
  telegram: optionalText,
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8, "newPassword must be at least 8 characters").optional(),
}).refine((value) => !value.newPassword || Boolean(value.currentPassword), { message: "currentPassword is required", path: ["currentPassword"] });
