import { useState } from "react";
import { ArrowDownIcon, ArrowUpIcon, XIcon } from "lucide-react";
import { t } from "@/shared/config/index.js";
import type { Currency } from "@/shared/lib/index.js";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Loader,
} from "@/shared/ui/index.js";
import { useAdCreatives, useCreativeFile } from "@/entities/campaign/index.js";
import { formatMoney, type AdFigures } from "@/entities/report/index.js";

export const MAX_CHOSEN_ADS = 6;

function resultOf(ad: AdFigures, currency: Currency): string {
  return ad.leads === 0
    ? t("report.ads.noLeads")
    : `${ad.leads} ${t("report.ads.result")} ${formatMoney(ad.costPerLead, currency)}`;
}

function AdThumbnail({ ad }: { ad: AdFigures }) {
  const creatives = useAdCreatives(ad.adId);
  const creative = creatives.data?.find((candidate) => candidate.hasFile || candidate.hasPoster);
  const playable = creative?.kind === "VIDEO" && creative.hasFile;
  const part = creative?.hasFile && (creative.kind === "IMAGE" || playable) ? "file" : "poster";
  const file = useCreativeFile(creative?.id, part);

  return (
    <div className="grid aspect-square place-items-center overflow-hidden bg-muted/40">
      {creatives.isPending || (creative && file.isPending) ? <Loader size="sm" /> : null}
      {file.data != null ? (
        playable
          ? <video src={file.data} controls aria-label={ad.name} className="size-full object-cover" />
          : <img src={file.data} alt={ad.name} className="size-full object-cover" />
      ) : null}
    </div>
  );
}

export function BestAds({
  ads,
  running,
  currency,
  editable,
  pending,
  onChoose,
}: {
  ads: AdFigures[];
  running: AdFigures[];
  currency: Currency;
  editable: boolean;
  pending: boolean;
  onChoose: (adIds: string[]) => void;
}) {
  const [picking, setPicking] = useState(false);
  const chosen = ads.map((ad) => ad.adId);
  const move = (index: number, offset: number) => {
    const next = [...chosen];
    [next[index], next[index + offset]] = [next[index + offset]!, next[index]!];
    onChoose(next);
  };

  return (
    <section aria-labelledby="report-ads" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="report-ads" className="text-sm font-semibold text-foreground">{t("report.ads")}</h2>
        {editable ? (
          <Button size="sm" variant="outline" onClick={() => setPicking(true)}>{t("report.ads.pick")}</Button>
        ) : null}
      </div>
      {ads.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("report.ads.empty")}</p>
      ) : (
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ads.map((ad, index) => (
            <li key={ad.adId} aria-label={ad.name} className="overflow-hidden rounded-lg border border-border">
              <AdThumbnail ad={ad} />
              <div className="flex flex-col gap-1 p-3">
                <span className="truncate text-sm font-medium text-foreground" title={ad.name}>{ad.name}</span>
                <span className="text-sm tabular-nums text-muted-foreground">{resultOf(ad, currency)}</span>
                {editable ? (
                  <div className="mt-1 flex gap-1">
                    <Button size="icon-sm" variant="ghost" aria-label={`${t("report.ads.moveUp")}: ${ad.name}`} disabled={pending || index === 0} onClick={() => move(index, -1)}>
                      <ArrowUpIcon />
                    </Button>
                    <Button size="icon-sm" variant="ghost" aria-label={`${t("report.ads.moveDown")}: ${ad.name}`} disabled={pending || index === ads.length - 1} onClick={() => move(index, 1)}>
                      <ArrowDownIcon />
                    </Button>
                    <Button size="icon-sm" variant="ghost" aria-label={`${t("report.ads.remove")}: ${ad.name}`} disabled={pending} onClick={() => onChoose(chosen.filter((id) => id !== ad.adId))}>
                      <XIcon />
                    </Button>
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
      {picking ? (
        <AdPicker
          running={running}
          chosen={chosen}
          currency={currency}
          onClose={() => setPicking(false)}
          onSave={(next) => { onChoose(next); setPicking(false); }}
        />
      ) : null}
    </section>
  );
}

function AdPicker({
  running,
  chosen,
  currency,
  onClose,
  onSave,
}: {
  running: AdFigures[];
  chosen: string[];
  currency: Currency;
  onClose: () => void;
  onSave: (adIds: string[]) => void;
}) {
  const [selected, setSelected] = useState(() => new Set(chosen));
  const full = selected.size >= MAX_CHOSEN_ADS;
  const toggle = (adId: string) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(adId)) next.delete(adId);
    else next.add(adId);
    return next;
  });
  const ordered = [
    ...chosen.filter((id) => selected.has(id)),
    ...running.map((ad) => ad.adId).filter((id) => selected.has(id) && !chosen.includes(id)),
  ];

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("report.ads.pick")}</DialogTitle>
          <DialogDescription>{t("report.ads.limit")}</DialogDescription>
        </DialogHeader>
        <ul className="flex max-h-[50vh] flex-col gap-1 overflow-y-auto">
          {[...running].sort((a, b) => b.leads - a.leads).map((ad) => (
            <li key={ad.adId}>
              <label className="flex items-center gap-3 rounded-md p-2 hover:bg-muted/50">
                <input
                  type="checkbox"
                  checked={selected.has(ad.adId)}
                  disabled={full && !selected.has(ad.adId)}
                  onChange={() => toggle(ad.adId)}
                />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm text-foreground">{ad.name}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">{resultOf(ad, currency)}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>{t("action.cancel")}</Button>
          <Button onClick={() => onSave(ordered)}>{t("action.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
