import { z } from 'zod';
import { KPI_METRICS, MANUAL_KPI } from '#modules/kpi/domain/kpi.js';

const amount = z.string().regex(/^\d{1,14}(\.\d{1,4})?$/);
const target = amount.refine((value) => Number(value) > 0, 'Target must be positive');

export const kpiInputSchema = z.discriminatedUnion('metric', [
  z.object({ metric: z.enum(KPI_METRICS), target }).strict(),
  z.object({
    metric: z.literal(MANUAL_KPI),
    name: z.string().trim().min(1, 'name is required').max(100, 'name must be at most 100 characters'),
    value: amount,
    target,
  }).strict(),
]);

const updatedAt = z.iso.datetime();

export const kpiSchema = z.union([
  z.object({ metric: z.enum(KPI_METRICS), target: z.string(), updatedAt }),
  z.object({ metric: z.literal(MANUAL_KPI), name: z.string(), value: z.string(), target: z.string(), updatedAt }),
]);
