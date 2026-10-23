import { kpiProgress, type KpiFigures, type MeasuredKpiInput } from "@/entities/kpi/index.js";
import type { PerformanceTone } from "@/entities/campaign/index.js";
import { kpiTitle } from "@/features/kpi-target/index.js";
import { t } from "@/shared/config/index.js";
import { cn } from "@/shared/lib/index.js";

export interface CampaignKpiItem {
  id: string;
  name: string;
  kpi: MeasuredKpiInput;
  performance: KpiFigures;
  tone: PerformanceTone;
}

export interface CampaignKpiStripProps {
  campaigns: readonly CampaignKpiItem[];
  range: { from: string; to: string };
  highlightedId?: string;
  onHighlight: (id: string | null) => void;
  onOpen: (id: string) => void;
}

const TONE_FILL: Record<PerformanceTone, string> = {
  idle: "bg-muted-foreground/40",
  danger: "bg-red-500",
  stable: "bg-amber-400",
  profitable: "bg-emerald-500",
};

export function CampaignKpiStrip({ campaigns, range, highlightedId, onHighlight, onOpen }: CampaignKpiStripProps) {
  if (campaigns.length === 0) return null;
  return (
    <div
      role="group"
      aria-label={t("campaigns.kpiProgress")}
      className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6"
    >
      {campaigns.map((campaign) => {
        const percent = kpiProgress(campaign.performance, campaign.kpi, range).percent;
        const rounded = percent === null ? null : Math.round(percent);
        const highlighted = campaign.id === highlightedId;
        return (
          <button
            key={campaign.id}
            type="button"
            data-tone={campaign.tone}
            data-highlighted={highlighted ? "true" : undefined}
            onMouseEnter={() => onHighlight(campaign.id)}
            onMouseLeave={() => onHighlight(null)}
            onFocus={() => onHighlight(campaign.id)}
            onBlur={() => onHighlight(null)}
            onClick={() => onOpen(campaign.id)}
            className={cn(
              "flex min-w-0 flex-col gap-1.5 rounded-lg border border-border glass-card px-3 py-2 text-left transition-colors",
              "hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-ring",
              highlighted && "border-primary/50",
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span aria-hidden className={cn("size-2 shrink-0 rounded-full", TONE_FILL[campaign.tone])} />
              <span title={campaign.name} className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                {campaign.name}
              </span>
            </span>
            <span className="flex min-w-0 items-baseline justify-between gap-2 text-xs text-muted-foreground">
              <span className="min-w-0 truncate">{kpiTitle(campaign.kpi)}</span>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                {rounded === null ? "—" : `${rounded}%`}
              </span>
            </span>
            <span aria-hidden className="h-1 overflow-hidden rounded-full bg-muted">
              <span
                className={cn("block h-full rounded-full", TONE_FILL[campaign.tone])}
                style={{ width: `${Math.min(100, rounded ?? 0)}%` }}
              />
            </span>
            <span className="sr-only">{t(`tone.${campaign.tone}`)}</span>
          </button>
        );
      })}
    </div>
  );
}
