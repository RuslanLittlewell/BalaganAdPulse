export { createCampaignUseCases } from "./application/campaign-use-cases.js";
export type {
  AdSetView, AdView, CampaignDependencies, CampaignReference, CampaignUseCases, CampaignView, CurrencyPerformance, ProjectFigures,
  TypedPerformance,
} from "./application/campaign-use-cases.js";
export type {
  AdRepository, AdSetRepository, CampaignRepository, ProjectReach, ReachableProject,
} from "./application/ports.js";
export type { CampaignChannel, CampaignDay, MetricRepository } from "./application/metric-ports.js";
export { CHANNELS } from "./domain/hierarchy.js";
export type { Ad, AdSet, Campaign, Channel, DateRange, DeliveryStatus, KpiAccount, KpiTarget, ProjectKpi } from "./domain/hierarchy.js";
export type { Derived, Measured, Performance } from "./domain/metrics.js";
export { performanceOf } from "./domain/metrics.js";
export { RESULT_TYPES, resultTypeOfGoal, sumByType } from "./domain/result-type.js";
export type { ResultType, ResultTypeFigure, TypedDay } from "./domain/result-type.js";
export { createCampaignHttpRouters } from "./presentation/http/campaign-http.js";
export type { CampaignHttpRouters } from "./presentation/http/campaign-http.js";
