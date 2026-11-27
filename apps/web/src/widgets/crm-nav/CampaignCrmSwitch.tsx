import { useCampaignCrmChange } from "@/entities/lead/index.js";
import { useCan } from "@/features/permissions/index.js";
import { t } from "@/shared/config/index.js";
import { Label, Switch, useAlerts } from "@/shared/ui/index.js";
import { useSelectedBoard } from "./CrmNav.js";

function BoardCampaignCrmSwitch({ boardKey, enabled }: { boardKey: string; enabled: boolean }) {
  const change = useCampaignCrmChange(boardKey);
  const { raise } = useAlerts();

  return (
    <div className="flex items-center gap-2">
      <Switch
        id="crm-campaign-crm"
        checked={enabled}
        disabled={change.isPending}
        onCheckedChange={(next) => change.mutate(next, { onError: () => raise(t("crm.campaignCrm.failed")) })}
      />
      <Label htmlFor="crm-campaign-crm" className="whitespace-nowrap text-sm font-normal">{t("crm.campaignCrm")}</Label>
    </div>
  );
}

export function CampaignCrmSwitch() {
  const manages = useCan("update", "lead-board");
  const { board } = useSelectedBoard();
  if (!manages || !board) return null;
  return <BoardCampaignCrmSwitch key={board.key} boardKey={board.key} enabled={board.campaignCrm ?? false} />;
}
