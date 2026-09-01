import { z } from "zod";

const email = z.string().trim().toLowerCase().pipe(z.email("invalid email"));
export const registerSchema = z.object({
  name: z.string().trim().min(1, "name is required"), email,
  password: z.string().min(8, "password must be at least 8 characters"),
  inviteCode: z.string().min(1, "inviteCode is required"),
});
export const loginSchema = z.object({ email, password: z.string().min(1, "password is required") });
export const refreshSchema = z.object({ refreshToken: z.string().min(1, "refreshToken is required") });
export const updateProfileSchema = z.object({
  name: z.string().trim().min(1, "name is required"), currentPassword: z.string().optional(),
  newPassword: z.string().min(8, "newPassword must be at least 8 characters").optional(),
}).refine((value) => !value.newPassword || Boolean(value.currentPassword), { message: "currentPassword is required", path: ["currentPassword"] });
