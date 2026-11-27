import { useMemo, useState } from "react";
import { isRunning, RunningDot, runningFirst, useCampaignReferences } from "@/entities/campaign/index.js";
import { t } from "@/shared/config/index.js";
import { Button, Label, Loader, SearchableSelect } from "@/shared/ui/index.js";
import { useWebsiteKey, useWebsiteKeyChange } from "../api/api.js";
import { Snippet } from "./Snippet.js";

export interface MarquizPanelProps {
  projectId: string;
  byCampaign?: boolean;
  campaignId?: string;
}

const addressOf = (websiteKey: string, campaignId?: string) =>
  `${window.location.origin}/api/intake/marquiz/${websiteKey}${campaignId ? `/${campaignId}` : ""}`;

function WebhookAddress({ address, campaignHint }: { address: string; campaignHint?: boolean }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">{t("marquiz.address")}</h3>
      <Snippet value={address} label={t("marquiz.copy")} />
      {campaignHint ? <p className="text-xs text-muted-foreground">{t("marquiz.campaignHint")}</p> : null}
      <p className="text-xs text-muted-foreground">{t("marquiz.hint")}</p>
    </section>
  );
}

function CampaignAddress({ projectId, websiteKey, campaignId }: { projectId: string; websiteKey: string; campaignId?: string }) {
  const references = useCampaignReferences(projectId);
  const campaigns = useMemo(() => runningFirst(references.data ?? []), [references.data]);
  const [picked, setPicked] = useState<string>();
  const campaign = campaigns.find((entry) => entry.id === (picked ?? campaignId));

  if (references.isPending) return <Loader label={t("campaigns.loading")} />;
  if (references.isError) return <p role="alert" className="text-sm text-destructive">{t("marquiz.campaignsFailed")}</p>;
  if (campaigns.length === 0) return <p className="text-sm">{t("marquiz.noCampaigns")}</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="marquiz-campaign">{t("marquiz.campaign")}</Label>
        <SearchableSelect
          id="marquiz-campaign"
          value={campaign?.id ?? ""}
          onValueChange={setPicked}
          options={campaigns.map((entry) => ({
            value: entry.id,
            label: entry.name,
            node: <span className="flex min-w-0 items-center gap-2"><RunningDot running={isRunning(entry.status)} /><span className="truncate">{entry.name}</span></span>,
          }))}
          placeholder={t("marquiz.chooseCampaign")}
          searchLabel={t("crm.campaign.search")}
          emptyLabel={t("select.search.empty")}
        />
      </div>
      {campaign
        ? <WebhookAddress address={addressOf(websiteKey, campaign.id)} campaignHint />
        : <p className="text-sm text-muted-foreground">{t("marquiz.campaignNeeded")}</p>}
    </div>
  );
}

export function MarquizPanel({ projectId, byCampaign = false, campaignId }: MarquizPanelProps) {
  const key = useWebsiteKey(projectId);
  const change = useWebsiteKeyChange(projectId);
  const [failed, setFailed] = useState(false);
  const current = key.data ?? null;

  async function create() {
    setFailed(false);
    try {
      await change.create.mutateAsync();
    } catch {
      setFailed(true);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {key.isPending ? (
        <Loader label={t("state.loading")} />
      ) : key.isError ? (
        <p role="alert" className="text-sm text-destructive">{t("website.loadFailed")}</p>
      ) : current ? (
        byCampaign
          ? <CampaignAddress projectId={projectId} websiteKey={current.key} campaignId={campaignId} />
          : <WebhookAddress address={addressOf(current.key)} />
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm">{t("marquiz.noKey")}</p>
          <div className="flex justify-end">
            <Button type="button" disabled={change.create.isPending} onClick={() => void create()}>
              {t("website.create")}
            </Button>
          </div>
        </div>
      )}
      {failed ? <p role="alert" className="text-sm text-destructive">{t("website.failed")}</p> : null}
    </div>
  );
}
