import { useState } from "react";
import { isRunning, useCampaignReferences, type CampaignReference } from "@/entities/campaign/index.js";
import type { Project } from "@/entities/project/index.js";
import { t } from "@/shared/config/index.js";
import { cn } from "@/shared/lib/index.js";
import {
  Label,
  MultiSelect,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from "@/shared/ui/index.js";

const MANUAL = "manual";

export function accountOf(campaign: Pick<CampaignReference, "channel" | "accountId">): string {
  return campaign.accountId ? `${campaign.channel}:${campaign.accountId}` : MANUAL;
}

function accountLabel(campaign: Pick<CampaignReference, "channel" | "accountId">): string {
  return campaign.accountId ? `${t(`channel.${campaign.channel}`)} · ${campaign.accountId}` : t("invites.partner.manual");
}

export interface PartnerTargetProps {
  projects: readonly Project[];
  projectId: string;
  campaignIds: readonly string[];
  onProjectChange: (projectId: string) => void;
  onCampaignsChange: (campaignIds: string[]) => void;
}

export function PartnerTarget({ projects, projectId, campaignIds, onProjectChange, onCampaignsChange }: PartnerTargetProps) {
  const campaigns = useCampaignReferences(projectId || undefined);
  const [activeOnly, setActiveOnly] = useState(true);
  const [unchosenAccounts, setUnchosenAccounts] = useState<string[]>([]);
  const all = campaigns.data ?? [];
  const accounts = [...new Map(all.map((campaign) => [accountOf(campaign), accountLabel(campaign)]))].map(([value, label]) => ({ value, label }));
  const chosenAccounts = accounts.map((account) => account.value).filter((account) => !unchosenAccounts.includes(account));
  const inAccounts = all.filter((campaign) => chosenAccounts.includes(accountOf(campaign)));
  const shown = activeOnly ? inAccounts.filter((campaign) => isRunning(campaign.status)) : inAccounts;
  const items = shown.map((campaign) => {
    const running = isRunning(campaign.status);
    return {
      value: campaign.id,
      label: campaign.name,
      icon: (
        <span
          data-running={running}
          className={cn("block size-2 rounded-full", running ? "bg-emerald-500" : "bg-destructive")}
        />
      ),
    };
  });

  function keep(allowed: readonly CampaignReference[]) {
    const ids = new Set(allowed.map((campaign) => campaign.id));
    const kept = campaignIds.filter((id) => ids.has(id));
    if (kept.length !== campaignIds.length) onCampaignsChange(kept);
  }

  function chooseProject(id: string) {
    setUnchosenAccounts([]);
    onProjectChange(id);
  }

  function chooseAccounts(next: string[]) {
    setUnchosenAccounts(accounts.map((account) => account.value).filter((account) => !next.includes(account)));
    keep(all.filter((campaign) => next.includes(accountOf(campaign))));
  }

  function filter(next: boolean) {
    setActiveOnly(next);
    if (next) keep(all.filter((campaign) => isRunning(campaign.status)));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="invitation-partner-project">{t("invites.partner.project")}</Label>
        <Select value={projectId} onValueChange={chooseProject}>
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

      {projectId && accounts.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground">{t("invites.partner.accounts")}</span>
          <MultiSelect
            items={accounts}
            chosen={chosenAccounts}
            onChange={chooseAccounts}
            placeholder={t("invites.partner.chooseAccounts")}
            ariaLabel={t("invites.partner.accounts")}
            allLabel={t("invites.partner.allAccounts")}
            className="w-full"
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">{t("invites.partner.campaign")}</span>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch checked={activeOnly} aria-label={t("invites.partner.activeOnly")} onCheckedChange={filter} />
            {t("invites.partner.activeOnly")}
          </label>
        </div>
        <MultiSelect
          items={items}
          chosen={campaignIds}
          onChange={onCampaignsChange}
          placeholder={t("invites.partner.chooseCampaign")}
          ariaLabel={t("invites.partner.campaign")}
          allLabel={t("invites.partner.allCampaigns")}
          searchable
          className="w-full"
        />
        {projectId && campaigns.isSuccess && items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {all.length === 0 ? t("invites.partner.noCampaigns") : t("invites.partner.noActive")}
          </p>
        ) : null}
      </div>

      <p className="text-sm text-muted-foreground">{t("invites.partner.hint")}</p>
    </div>
  );
}
