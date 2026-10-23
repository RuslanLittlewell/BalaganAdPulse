import { z } from 'zod';
import { RESULT_TYPES } from '#modules/campaigns/index.js';
import { KPI_METRICS, MANUAL_KPI, MAX_PROJECT_KPIS } from '#modules/kpi/domain/kpi.js';

const amount = z.string().regex(/^\d{1,14}(\.\d{1,4})?$/);
const target = amount.refine((value) => Number(value) > 0, 'Target must be positive');
const manualName = z.string().trim().min(1, 'name is required').max(100, 'name must be at most 100 characters');

export const kpiInputSchema = z.discriminatedUnion('metric', [
  z.object({ metric: z.enum(KPI_METRICS), target, resultType: z.enum(RESULT_TYPES).optional() }).strict(),
  z.object({ metric: z.literal(MANUAL_KPI), name: manualName, value: amount, target }).strict(),
]);

export const projectKpiInputSchema = z.discriminatedUnion('metric', [
  z.object({ metric: z.enum(KPI_METRICS), target, resultType: z.enum(RESULT_TYPES).optional(), enabled: z.boolean().default(true) }).strict(),
  z.object({ metric: z.literal(MANUAL_KPI), name: manualName, value: amount, target, enabled: z.boolean().default(true) }).strict(),
]);

export const projectKpiListSchema = z.array(projectKpiInputSchema).max(MAX_PROJECT_KPIS, `A project holds at most ${MAX_PROJECT_KPIS} KPIs`);

const updatedAt = z.iso.datetime();

export const kpiSchema = z.union([
  z.object({ metric: z.enum(KPI_METRICS), target: z.string(), resultType: z.enum(RESULT_TYPES).optional(), updatedAt }),
  z.object({ metric: z.literal(MANUAL_KPI), name: z.string(), value: z.string(), target: z.string(), updatedAt }),
]);

export const projectKpiSchema = z.union([
  z.object({ id: z.uuid(), metric: z.enum(KPI_METRICS), target: z.string(), resultType: z.enum(RESULT_TYPES).optional(), enabled: z.boolean(), updatedAt }),
  z.object({ id: z.uuid(), metric: z.literal(MANUAL_KPI), name: z.string(), value: z.string(), target: z.string(), enabled: z.boolean(), updatedAt }),
]);
