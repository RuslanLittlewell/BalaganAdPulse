import { Loader } from "@/shared/ui/index.js";
import { useAdPreview, type Creative } from "@/entities/campaign/index.js";
import { CreativeMedia } from "./CreativeMedia.js";

export interface AdPreviewFrameProps {
  adId: string;
  adName: string;
  externalId: string | null;
  variants: readonly Creative[];
}

export function AdPreviewFrame({ adId, adName, externalId, variants }: AdPreviewFrameProps) {
  const rendered = useAdPreview(adId);

  if (rendered.isPending) {
    return (
      <div className="grid min-h-40 place-items-center rounded-md border border-border bg-muted/30">
        <Loader size="sm" />
      </div>
    );
  }

  if (rendered.data == null) {
    return (
      <>
        {variants.map((creative) => (
          <CreativeMedia
            key={creative.id}
            creative={creative}
            adName={adName}
            externalId={externalId}
          />
        ))}
      </>
    );
  }

  return (
    <iframe
      src={rendered.data.url}
      title={adName}
      className="h-[70vh] w-full rounded-md border border-border"
      referrerPolicy="no-referrer"
      allow="autoplay; encrypted-media"
    />
  );
}
