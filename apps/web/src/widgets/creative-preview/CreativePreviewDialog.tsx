import { useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Loader,
} from "@/shared/ui/index.js";
import { t } from "@/shared/config/index.js";
import { useAdCreatives, type Ad } from "@/entities/campaign/index.js";
import { AdPreviewFrame } from "./AdPreviewFrame.js";
import { CreativeMedia } from "./CreativeMedia.js";

export interface CreativePreviewDialogProps {
  ads: Ad[];
  initialAdId: string;
  onClose: () => void;
}

export function CreativePreviewDialog({ ads, initialAdId, onClose }: CreativePreviewDialogProps) {
  const [shownId, setShownId] = useState(initialAdId);
  const index = Math.max(0, ads.findIndex((ad) => ad.id === shownId));
  const shown = ads[index];
  const creatives = useAdCreatives(shown?.id);

  if (!shown) return null;

  const variants = creatives.data ?? [];
  const stored = variants.filter((creative) => creative.hasFile);
  const unplayable = variants.filter(
    (creative) => creative.kind === "VIDEO" && !creative.hasFile,
  );

  const step = (by: number) => {
    const next = ads[index + by];
    if (next) setShownId(next.id);
  };

  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="w-[min(720px,calc(100vw-2rem))] max-w-none">
        <DialogHeader>
          <DialogTitle>{shown.name}</DialogTitle>
          <DialogDescription>{t("creatives.dialog")}</DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[70vh] gap-4 overflow-auto">
          {creatives.isPending && (
            <div className="grid min-h-40 place-items-center rounded-md border border-border bg-muted/30">
              <Loader size="sm" />
            </div>
          )}

          {creatives.isError && (
            <p className="py-8 text-center text-sm text-destructive">{t("creatives.failed")}</p>
          )}

          {creatives.isSuccess && variants.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("creatives.empty")}</p>
          )}

          {unplayable.length > 0 && (
            <AdPreviewFrame
              adId={shown.id}
              adName={shown.name}
              externalId={shown.externalId}
              variants={unplayable}
            />
          )}

          {stored.map((creative) => (
            <CreativeMedia
              key={creative.id}
              creative={creative}
              adName={shown.name}
              externalId={shown.externalId}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={t("creatives.previous")}
            disabled={index === 0}
            onClick={() => step(-1)}
          >
            <ChevronLeftIcon aria-hidden="true" />
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums">
            {index + 1} / {ads.length}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={t("creatives.next")}
            disabled={index === ads.length - 1}
            onClick={() => step(1)}
          >
            <ChevronRightIcon aria-hidden="true" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
