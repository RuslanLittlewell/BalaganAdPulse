import { t } from "@/shared/config/index.js";
import { isLeadStage, LEAD_STAGES, type LeadColumn } from "../api/api.js";

export const FIXED_LEAD_COLUMNS: readonly LeadColumn[] = LEAD_STAGES.map((id, position) => ({
  id, kind: "FIXED", name: t(`crm.stage.${id}`), position,
}));

export function leadColumnLabel(column: LeadColumn): string {
  return column.kind === "FIXED" && isLeadStage(column.id) ? t(`crm.stage.${column.id}`) : column.name;
}
