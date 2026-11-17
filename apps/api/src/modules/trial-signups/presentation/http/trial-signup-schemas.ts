import { z } from "zod";
import { NAME_LIMIT, atMost } from "#shared/presentation/input-schemas.js";

const bounded = (label: string) => z.string().trim().min(1, `${label} is required`).max(NAME_LIMIT, `${label} ${atMost(NAME_LIMIT)}`);

export const trialSignupSchema = z.object({
  organizationName: bounded("organizationName"),
  name: bounded("name"),
  email: z.string().trim().toLowerCase().pipe(z.email("invalid email")),
  password: z.string().min(8, "password must be at least 8 characters"),
});
