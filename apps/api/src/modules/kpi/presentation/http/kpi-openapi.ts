import type { RouteDoc } from '#shared/presentation/openapi.js';
import { z } from 'zod';
import { kpiInputSchema, kpiSchema, projectKpiListSchema, projectKpiSchema } from './kpi-schemas.js';

const level = (path: string, name: string, errors: { read: number[]; write: number[] }): RouteDoc['operations'] => [
  { method: 'get', path, summary: `Read the ${name} KPI`, success: { status: 200, description: 'The KPI, or null when none is set', schema: kpiSchema.nullable() }, errors: [401, ...errors.read] },
  { method: 'put', path, summary: `Set or replace the ${name} KPI`, body: kpiInputSchema, success: { status: 200, description: 'The saved KPI', schema: kpiSchema }, errors: [400, 401, ...errors.write] },
  { method: 'delete', path, summary: `Clear the ${name} KPI`, success: { status: 204, description: 'No KPI remains' }, errors: [401, ...errors.write] },
];

export const kpiDoc: RouteDoc = {
  tag: 'KPI',
  tagDescription: 'One goal per organization and campaign, and several per project: a metric and a positive target with four decimals. Summable metrics hold a monthly target; ratios hold the target value. A project may instead hold a goal set by hand, metric MANUAL with a name and a value of its own, compared with the target as it is. The KPIs of a project are read and replaced as one ordered list, each with an enabled flag: a switched-off KPI does not count toward the result of the project. A project KPI may name an advertising account, a channel and an account id, and is then measured only on the campaigns imported from that account; one naming none is common to the project. At most five KPIs may name one account, and at most five may name none.',
  operations: [
    ...level('/organization/kpi', 'organization', { read: [403], write: [403] }),
    { method: 'get', path: '/projects/:id/kpis', summary: 'Read the project KPIs in order', success: { status: 200, description: 'The KPIs, possibly none', schema: z.array(projectKpiSchema) }, errors: [401, 404] },
    { method: 'put', path: '/projects/:id/kpis', summary: 'Replace the project KPIs with the given list', body: projectKpiListSchema, success: { status: 200, description: 'The saved KPIs in order', schema: z.array(projectKpiSchema) }, errors: [400, 401, 403, 404] },
    ...level('/campaigns/:id/kpi', 'campaign', { read: [404], write: [403, 404] }),
  ],
};

