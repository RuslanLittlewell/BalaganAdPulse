import { z } from "zod";

/** Normalize before validating, so `Buyer@Acme.com ` and `buyer@acme.com`
 * cannot both satisfy the unique constraint as two separate accounts. */
const email = z.string().trim().toLowerCase().pipe(z.email("invalid email"));

export const registerSchema = z.object({
  name: z.string().trim().min(1, "name is required"),
  email,
  password: z.string().min(8, "password must be at least 8 characters"),
  inviteCode: z.string().min(1, "inviteCode is required"),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "password is required"),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, "refreshToken is required"),
});

export const logoutSchema = refreshSchema;

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
