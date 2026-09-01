export { createRecordUseCases } from "./application/record-use-cases.js";
export type { RecordUseCases, ValueWriteResult } from "./application/record-use-cases.js";
export type {
  CampaignReach,
  RecordDependencies,
  RecordRepository,
  RecordRow,
  ValueRepository,
} from "./application/ports.js";
export { describeChanges, normalizeValue, parseDay, validateValue } from "./domain/value.js";
export type { FieldChange, StoredCell, ValueInput, WritableProperty } from "./domain/value.js";
export { createRecordHttpRouters } from "./presentation/http/record-http.js";
