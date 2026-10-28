import { z } from "zod";
import { DETAIL_LIMIT, HANDLE_LIMIT, atMost } from "#shared/presentation/input-schemas.js";

const bounded = (limit: number) => z.string().max(limit, atMost(limit)).nullable().optional();
const contact = bounded(DETAIL_LIMIT);
const handle = bounded(HANDLE_LIMIT);

export const createClientSchema = z.object({
  name: z.string().min(1, "name is required").max(DETAIL_LIMIT, `name ${atMost(DETAIL_LIMIT)}`),
  fullName: contact,
  organization: contact,
  unp: contact,
  phone: handle,
  telegram: handle,
  email: z.email("invalid email").max(DETAIL_LIMIT, atMost(DETAIL_LIMIT)).nullable().optional(),
  website: contact,
});

export const updateClientSchema = createClientSchema.partial();
