import { t } from "@/shared/config/index.js";
import { isLeadStage, LEAD_STAGES, type LeadColumn, type LeadStage, type OptionColor } from "../api/api.js";

export const FIXED_STAGE_COLORS: Record<LeadStage, OptionColor> = { NEW: "blue", QUALIFIED: "purple", TARGET: "orange", PROPOSAL: "green" };

export const FIXED_LEAD_COLUMNS: readonly LeadColumn[] = LEAD_STAGES.map((id, position) => ({
  id, kind: "FIXED", name: t(`crm.stage.${id}`), position, color: FIXED_STAGE_COLORS[id],
}));

export function leadColumnLabel(column: LeadColumn): string {
  return column.kind === "FIXED" && isLeadStage(column.id) ? t(`crm.stage.${column.id}`) : column.name;
}
