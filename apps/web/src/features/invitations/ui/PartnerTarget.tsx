import { useState } from "react";
import { isRunning, useCampaignReferences } from "@/entities/campaign/index.js";
import type { Project } from "@/entities/project/index.js";
import { t } from "@/shared/config/index.js";
import { cn } from "@/shared/lib/index.js";
import {
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SearchableSelect,
  Switch,
} from "@/shared/ui/index.js";

export interface PartnerTargetProps {
  projects: readonly Project[];
  projectId: string;
  campaignId: string;
  onProjectChange: (projectId: string) => void;
  onCampaignChange: (campaignId: string) => void;
}

export function PartnerTarget({ projects, projectId, campaignId, onProjectChange, onCampaignChange }: PartnerTargetProps) {
  const campaigns = useCampaignReferences(projectId || undefined);
  const [activeOnly, setActiveOnly] = useState(true);
  const all = campaigns.data ?? [];
  const shown = activeOnly ? all.filter((campaign) => isRunning(campaign.status)) : all;
  const options = shown.map((campaign) => {
    const running = isRunning(campaign.status);
    return {
      value: campaign.id,
      label: campaign.name,
      node: (
        <span className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden
            data-running={running}
            className={cn("size-2 shrink-0 rounded-full", running ? "bg-emerald-500" : "bg-destructive")}
          />
          <span className="truncate">{campaign.name}</span>
        </span>
      ),
    };
  });

  function filter(next: boolean) {
    setActiveOnly(next);
    if (next && campaignId && !all.some((campaign) => campaign.id === campaignId && isRunning(campaign.status))) {
      onCampaignChange("");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="invitation-partner-project">{t("invites.partner.project")}</Label>
        <Select value={projectId} onValueChange={onProjectChange}>
          <SelectTrigger id="invitation-partner-project" className="w-full">
            <SelectValue placeholder={t("invites.partner.chooseProject")} />
          </SelectTrigger>
          <SelectContent>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="invitation-partner-campaign">{t("invites.partner.campaign")}</Label>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch checked={activeOnly} aria-label={t("invites.partner.activeOnly")} onCheckedChange={filter} />
            {t("invites.partner.activeOnly")}
          </label>
        </div>
        <SearchableSelect
          id="invitation-partner-campaign"
          ariaLabel={t("invites.partner.campaign")}
          value={campaignId}
          onValueChange={onCampaignChange}
          options={options}
          placeholder={t("invites.partner.chooseCampaign")}
          searchLabel={t("select.search")}
          emptyLabel={t("select.search.empty")}
          disabled={!projectId}
        />
        {projectId && campaigns.isSuccess && options.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {all.length === 0 ? t("invites.partner.noCampaigns") : t("invites.partner.noActive")}
          </p>
        ) : null}
      </div>

      <p className="text-sm text-muted-foreground">{t("invites.partner.hint")}</p>
    </div>
  );
}
