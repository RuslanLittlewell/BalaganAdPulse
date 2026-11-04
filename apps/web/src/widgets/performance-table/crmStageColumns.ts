import { t } from "@/shared/config/index.js";
import type { LeadStage, StageCounts } from "@/entities/lead/index.js";
import type { ExtraColumn } from "./PerformanceTable.js";

export const CAMPAIGN_LEAD_STAGES: readonly LeadStage[] = ["QUALIFIED", "TARGET", "PROPOSAL"];

const stageColumnId = (stage: LeadStage) => `crm-${stage}`;

export function crmStageColumns(stages: readonly LeadStage[]): ExtraColumn[] {
  return stages.map((stage) => ({ id: stageColumnId(stage), label: t(`crm.column.${stage}`) }));
}

export function crmStageFigures(
  counts: readonly (StageCounts | undefined)[],
  stages: readonly LeadStage[],
): Record<string, number> {
  return Object.fromEntries(
    stages.map((stage) => [stageColumnId(stage), counts.reduce((sum, row) => sum + (row?.[stage] ?? 0), 0)]),
  );
}
