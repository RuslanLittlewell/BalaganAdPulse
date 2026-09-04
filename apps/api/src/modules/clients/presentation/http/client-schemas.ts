import { z } from "zod";

const contact = z.string().nullable().optional();

export const createClientSchema = z.object({
  name: z.string().min(1, "name is required"),
  fullName: contact,
  organization: contact,
  unp: contact,
  phone: contact,
  telegram: contact,
  email: z.email("invalid email").nullable().optional(),
  website: contact,
});

export const updateClientSchema = createClientSchema.partial();
