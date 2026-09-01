import { useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, type TabItemAction } from "@/shared/ui/index.js";
import { PencilIcon } from "lucide-react";
import { t } from "@/shared/config/index.js";
import { projectPath } from "@/shared/lib/index.js";
import type { CampaignSummary } from "@/entities/campaign/index.js";
import { useCan } from "@/features/permissions/index.js";

export interface CampaignTabsProps {
  projectId: string;
  campaigns: CampaignSummary[];
  activeCampaignId?: string;
  onNew: () => void;
  onRename: (campaignId: string) => void;
}

export function CampaignTabs({
  projectId,
  campaigns,
  activeCampaignId,
  onNew,
  onRename,
}: CampaignTabsProps) {
  const navigate = useNavigate();
  const mayCreate = useCan("create", "campaign");
  const mayUpdate = useCan("update", "campaign");

  const itemActions: TabItemAction[] = useMemo(
    () => mayUpdate ? [
      {
        icon: <PencilIcon className="size-3.5" />,
        label: t("campaigns.rename"),
        onSelect: onRename,
      },
    ] : [],
    [mayUpdate, onRename],
  );

  const items = useMemo(
    () =>
      campaigns.map((campaign) => ({ id: campaign.id, label: campaign.name })),
    [campaigns],
  );

  const onSelect = useCallback(
    (campaignId: string) => navigate(projectPath(projectId, campaignId)),
    [navigate, projectId],
  );

  return (
    <Tabs
      items={items}
      activeId={activeCampaignId}
      onSelect={onSelect}
      itemActions={itemActions}
      onNew={mayCreate ? onNew : undefined}
    />
  );
}
