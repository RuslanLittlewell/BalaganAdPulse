export { createCampaignUseCases } from "./application/campaign-use-cases.js";
export type {
  CampaignTable,
  CampaignUseCases,
  CreatePropertyInput,
  UpdatePropertyInput,
} from "./application/campaign-use-cases.js";
export type {
  CampaignDependencies,
  CampaignRecord,
  CampaignRepository,
  PropertyRecord,
  PropertyRepository,
  ProjectReach,
  TableData,
} from "./application/ports.js";
export type { BinaryOperator, Expression } from "./domain/expression.js";
export { collectPropertyRefs, evaluate } from "./domain/expression.js";
export { PROPERTY_TYPES, assertFormulaIsValid, assertWritable, findDependents } from "./domain/property.js";
export type { PropertyType } from "./domain/property.js";
export { computeTable } from "./domain/table.js";
export type { ComputedRecord, ComputedTable, StoredValue, TableProperty, TableRecord } from "./domain/table.js";
export { createCampaignHttpRouters } from "./presentation/http/campaign-http.js";
export { DEFAULT_CAMPAIGN_NAME, buildDefaultProperties } from "./domain/defaults.js";
export type { DefaultProperty } from "./domain/defaults.js";
