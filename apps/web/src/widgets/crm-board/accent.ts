import { isLeadStage, type LeadStage } from "@/entities/lead/index.js";

const STAGE_ACCENT: Record<LeadStage, string> = {
  NEW: "bg-slate-400",
  QUALIFIED: "bg-cyan-500",
  TARGET: "bg-amber-500",
  PROPOSAL: "bg-violet-500",
};

const CUSTOM_ACCENT = "bg-primary/60";

export function accentOf(stageOrColumnId: string): string {
  return isLeadStage(stageOrColumnId) ? STAGE_ACCENT[stageOrColumnId] : CUSTOM_ACCENT;
}
