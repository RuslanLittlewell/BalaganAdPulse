import { z } from "zod";

export const createRecordSchema = z.object({
  date: z.iso.date("date must be in YYYY-MM-DD format"),
});

export const updateRecordSchema = createRecordSchema;

export const setValueSchema = z.object({
  value: z.union([z.string(), z.null()]),
});

export const setValuesSchema = z.object({
  values: z.array(z.object({
    propertyId: z.uuid(),
    value: z.union([z.string(), z.null()]),
  })).min(1).max(100),
}).superRefine(({ values }, ctx) => {
  const ids = values.map(({ propertyId }) => propertyId);
  if (new Set(ids).size !== ids.length) {
    ctx.addIssue({ code: "custom", path: ["values"], message: "Property ids must be unique" });
  }
});
