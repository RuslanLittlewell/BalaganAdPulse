export {
  AGENCY_BOARD,
  COLUMN_NAME_LIMIT,
  isLeadStage,
  LEAD_STAGES,
  leadsApi,
} from "./api/api.js";
export type {
  BoardCapabilities,
  Lead,
  LeadAd,
  LeadAssignee,
  LeadAnswer,
  LeadBoard,
  LeadColumn,
  LeadColumnInput,
  CountingPeriod,
  ProjectStageCounts,
  LeadMetaSource,
  LeadOrigin,
  LeadInput,
  LeadProject,
  LeadMove,
  LeadStage,
} from "./api/api.js";
export {
  BOARDS_KEY,
  leadColumnsKey,
  leadsKey,
  useCreateLead,
  useCreateLeadColumn,
  useDeleteLead,
  useDeleteLeadColumn,
  useLeadBoards,
  useLeadColumns,
  useLeads,
  useProjectStageCounts,
  useUpdateLeadColumn,
  useMoveLead,
  useUpdateLead,
} from "./api/queries.js";
export { FIXED_LEAD_COLUMNS, leadColumnLabel } from "./lib/columns.js";
export {
  applyLeadMove,
  leadPlacementFor,
  leadPreviewFor,
  resolveLeadDrop,
} from "./lib/ordering.js";
export { useCrmEvents, CRM_EVENTS_BASE_DELAY_MS, CRM_EVENTS_MAX_DELAY_MS } from "./api/useCrmEvents.js";
export type { CrmEvent, CrmEventsOptions } from "./api/useCrmEvents.js";
