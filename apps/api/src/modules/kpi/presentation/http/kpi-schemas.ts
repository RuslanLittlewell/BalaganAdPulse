import { z } from 'zod';
import { KPI_METRICS } from '../../domain/kpi.js';

export const kpiInputSchema = z.object({
  metric: z.enum(KPI_METRICS),
  target: z.string().regex(/^\d{1,14}(\.\d{1,4})?$/).refine((value) => Number(value) > 0, 'Target must be positive'),
}).strict();

export const kpiSchema = z.object({ metric: z.enum(KPI_METRICS), target: z.string(), updatedAt: z.iso.datetime() });
