import { Loader } from "@/shared/ui/index.js";
import { t } from "@/shared/config/index.js";
import { useCreativeFile, type Creative } from "@/entities/campaign/index.js";

export interface CreativeMediaProps {
  creative: Creative;
  adName: string;
  externalId: string | null;
}

const ADS_MANAGER = "https://adsmanager.facebook.com/adsmanager/manage/ads";

export function CreativeMedia({ creative, adName, externalId }: CreativeMediaProps) {
  const playable = creative.kind === "VIDEO" && creative.hasFile;
  const part = creative.hasFile && creative.kind === "IMAGE" ? "file" : playable ? "file" : "poster";
  const file = useCreativeFile(
    creative.hasFile || creative.hasPoster ? creative.id : undefined,
    part,
  );
  const label = creative.title ?? adName;

  return (
    <figure className="m-0 grid gap-2">
      <div className="grid min-h-40 place-items-center overflow-hidden rounded-md border border-border bg-muted/30">
        {file.isPending && (creative.hasFile || creative.hasPoster) && <Loader size="sm" />}
        {file.isError && <p className="p-4 text-sm text-destructive">{t("creatives.failed")}</p>}
        {file.data != null && (playable ? (
          <video src={file.data} controls className="max-h-[60vh] w-full" />
        ) : (
          <img src={file.data} alt={label} className="max-h-[60vh] w-full object-contain" />
        ))}
      </div>

      <figcaption className="grid gap-1">
        {creative.title != null && (
          <span className="text-sm font-medium text-foreground">{creative.title}</span>
        )}
        {creative.body != null && (
          <span className="text-xs text-muted-foreground">{creative.body}</span>
        )}
        {creative.kind === "VIDEO" && !creative.hasFile && externalId != null && (
          <a
            className="text-xs text-primary underline"
            href={`${ADS_MANAGER}?selected_ad_ids=${externalId}`}
            target="_blank"
            rel="noreferrer noopener"
          >
            {t("creatives.external")}
          </a>
        )}
      </figcaption>
    </figure>
  );
}
