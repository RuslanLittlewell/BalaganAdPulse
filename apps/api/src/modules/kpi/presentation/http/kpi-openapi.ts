import type { RouteDoc } from '#shared/presentation/openapi.js';
import { kpiInputSchema, kpiSchema } from './kpi-schemas.js';

const level = (path: string, name: string, errors: { read: number[]; write: number[] }): RouteDoc['operations'] => [
  { method: 'get', path, summary: `Read the ${name} KPI`, success: { status: 200, description: 'The KPI, or null when none is set', schema: kpiSchema.nullable() }, errors: [401, ...errors.read] },
  { method: 'put', path, summary: `Set or replace the ${name} KPI`, body: kpiInputSchema, success: { status: 200, description: 'The saved KPI', schema: kpiSchema }, errors: [400, 401, ...errors.write] },
  { method: 'delete', path, summary: `Clear the ${name} KPI`, success: { status: 204, description: 'No KPI remains' }, errors: [401, ...errors.write] },
];

export const kpiDoc: RouteDoc = {
  tag: 'KPI',
  tagDescription: 'One goal per organization, project and campaign: a metric and a positive target with four decimals. Summable metrics hold a monthly target; ratios hold the target value.',
  operations: [
    ...level('/organization/kpi', 'organization', { read: [403], write: [403] }),
    ...level('/projects/:id/kpi', 'project', { read: [404], write: [403, 404] }),
    ...level('/campaigns/:id/kpi', 'campaign', { read: [404], write: [403, 404] }),
  ],
};

