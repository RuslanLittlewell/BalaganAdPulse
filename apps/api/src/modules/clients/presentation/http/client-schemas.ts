import { z } from "zod";

/** Free-form contact text. Deliberately unconstrained beyond being a string:
 * a UNP is nine digits in Belarus but a foreign client has something else, and
 * phone and Telegram handles are written a dozen different ways. */
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
