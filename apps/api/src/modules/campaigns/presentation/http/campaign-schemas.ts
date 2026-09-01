import { z } from "zod";

const CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A calendar day, read as UTC midnight.
 *
 * The buyer picked a day, not an instant, and the measured rows are stored at
 * UTC midnight for exactly that reason. Letting `new Date("2026-08-01")` be
 * interpreted in the server's zone would shift every boundary by the offset and
 * quietly drop a day from one end of the range.
 */
const day = z.string().regex(CALENDAR_DAY, "Expected a YYYY-MM-DD date")
  .transform((value) => new Date(`${value}T00:00:00.000Z`))
  .refine((date) => !Number.isNaN(date.getTime()), "Expected a real calendar date");

/** Both endpoints are required. A default range would make an unlabelled figure
 * look authoritative while answering a question nobody asked. */
export const rangeSchema = z.object({ from: day, to: day });

export type RangeInput = z.infer<typeof rangeSchema>;
