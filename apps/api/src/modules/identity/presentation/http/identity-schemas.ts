import { z } from "zod";
import { DETAIL_LIMIT, HANDLE_LIMIT, NAME_LIMIT, atMost } from "#shared/presentation/input-schemas.js";

const email = z.string().trim().toLowerCase().pipe(z.email("invalid email"));
const bounded = (limit: number) => z.string().trim().min(1).max(limit, atMost(limit)).nullable().optional();
const optionalText = bounded(DETAIL_LIMIT);
const handle = bounded(HANDLE_LIMIT);
const name = z.string().trim().min(1, "name is required").max(NAME_LIMIT, `name ${atMost(NAME_LIMIT)}`);

export const registerSchema = z.object({
  name, email,
  password: z.string().min(8, "password must be at least 8 characters"),
  inviteCode: z.string().min(1, "inviteCode is required"),
  phone: handle,
  telegram: handle,
  client: z.object({
    name: z.string().trim().min(1, "client name is required").max(DETAIL_LIMIT, `client name ${atMost(DETAIL_LIMIT)}`),
    fullName: optionalText,
    organization: optionalText,
    unp: optionalText,
    phone: handle,
    telegram: handle,
    email: optionalText,
    website: optionalText,
  }).optional(),
  project: z.object({
    name: z.string().trim().min(1, "project name is required").max(NAME_LIMIT, `project name ${atMost(NAME_LIMIT)}`),
  }).optional(),
}).refine(
  (value) => (value.client === undefined) === (value.project === undefined),
  { message: "A client registration needs both a contact and a project", path: ["project"] },
);
export const loginSchema = z.object({
  login: z.string().trim().toLowerCase().min(1, "login is required"),
  password: z.string().min(1, "password is required"),
});
export const refreshSchema = z.object({ refreshToken: z.string().min(1, "refreshToken is required") });
export const passwordResetRequestSchema = z.object({ email });
export const passwordResetSchema = z.object({
  password: z.string().min(8, "password must be at least 8 characters"),
});
export const updateProfileSchema = z.object({
  name,
  phone: handle,
  telegram: handle,
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8, "newPassword must be at least 8 characters").optional(),
}).refine((value) => !value.newPassword || Boolean(value.currentPassword), { message: "currentPassword is required", path: ["currentPassword"] });
