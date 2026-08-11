import { useNavigate } from "react-router-dom";
import { Tabs, type TabItemAction } from "../../../../components/Tabs/Tabs.js";
import { Button } from "../../../../components/Button/Button.js";
import { PencilIcon } from "../../../../components/PencilIcon/PencilIcon.js";
import { CrossIcon } from "../../../../components/CrossIcon/CrossIcon.js";
import { t } from "../../../../i18n/en.js";
import type { CampaignSummary } from "../../data/api.js";

export interface CampaignTabsProps {
  clientId: string;
  campaigns: CampaignSummary[];
  activeCampaignId?: string;
  onNew: () => void;
  onRename: (campaignId: string) => void;
  onDelete: (campaignId: string) => void;
}

export function CampaignTabs({
  clientId, campaigns, activeCampaignId, onNew, onRename, onDelete,
}: CampaignTabsProps) {
  const navigate = useNavigate();

  const itemActions: TabItemAction[] = [
    { icon: <PencilIcon />, label: t("campaigns.rename"), onSelect: onRename },
  ];
  // A client keeps at least one sheet, so the last one offers no delete control.
  if (campaigns.length > 1) {
    itemActions.push({ icon: <CrossIcon />, label: t("campaigns.delete"), onSelect: onDelete });
  }

  return (
    <Tabs
      items={campaigns.map((campaign) => ({ id: campaign.id, label: campaign.name }))}
      activeId={activeCampaignId}
      onSelect={(campaignId) => navigate(`/clients/${clientId}/campaigns/${campaignId}`)}
      itemActions={itemActions}
      action={
        <Button variant="ghost" size="sm" onClick={onNew}>
          + {t("campaigns.new")}
        </Button>
      }
    />
  );
}
