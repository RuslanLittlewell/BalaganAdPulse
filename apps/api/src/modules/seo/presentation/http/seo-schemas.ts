import { z } from "zod";
import { PROBLEM_KINDS } from "#modules/seo/domain/page-audit.js";

const MAX_DAYS = 1000;

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a YYYY-MM-DD date")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), "Expected a real calendar date");

const spans = (range: { from: string; to: string }) => {
  const length = (Date.parse(`${range.to}T00:00:00Z`) - Date.parse(`${range.from}T00:00:00Z`)) / 86_400_000;
  return length >= 0 && length <= MAX_DAYS;
};

export const seoRangeSchema = z.object({ from: day, to: day })
  .refine(spans, `Expected from no later than to, at most ${MAX_DAYS} days apart`);

export const seoTopSchema = z.object({
  from: day,
  to: day,
  kind: z.enum(["query", "page"]),
  limit: z.coerce.number().int().min(1).max(100).default(10),
}).refine(spans, `Expected from no later than to, at most ${MAX_DAYS} days apart`);

export const seoKindSchema = z.object({ kind: z.enum(PROBLEM_KINDS).optional() });
