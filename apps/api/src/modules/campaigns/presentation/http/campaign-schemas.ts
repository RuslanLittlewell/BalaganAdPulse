import { z } from "zod";

const CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/;

const day = z.string().regex(CALENDAR_DAY, "Expected a YYYY-MM-DD date")
  .transform((value) => new Date(`${value}T00:00:00.000Z`))
  .refine((date) => !Number.isNaN(date.getTime()), "Expected a real calendar date");

export const rangeSchema = z.object({ from: day, to: day });

export type RangeInput = z.infer<typeof rangeSchema>;
