export { createKpiUseCases } from './application/kpi-use-cases.js';
export type { KpiUseCases } from './application/kpi-use-cases.js';
export type { ProjectKpiEvents } from './application/ports.js';
export { createKpiRouter } from './presentation/http/kpi-http.js';
export { kpiDoc } from './presentation/http/kpi-openapi.js';
export { isKpiGreen, kpiPercent, monthToDate, targetForRange } from './domain/progress.js';
export type { IsoDateRange, KpiFigure, KpiFigures } from './domain/progress.js';
export { isKpiMetric, MANUAL_KPI } from './domain/kpi.js';
export type { KpiInput, KpiMetric } from './domain/kpi.js';
