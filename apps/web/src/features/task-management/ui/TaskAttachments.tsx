import { useEffect, useState } from "react";
import { taskImagesApi } from "@/entities/task/index.js";
import { t } from "@/shared/config/index.js";

export interface TaskAttachmentsProps {
  imageIds: readonly string[];
}

/**
 * The files a task carries, listed in their own block.
 *
 * Each is fetched with the member's token and shown from an object URL, which
 * is revoked when the block goes away — the same reason the description's
 * images cannot simply keep a `src`.
 */
export function TaskAttachments({ imageIds }: TaskAttachmentsProps) {
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    const made: string[] = [];

    void Promise.all(imageIds.map(async (id) => {
      try {
        const url = await taskImagesApi.blobUrl(id);
        if (cancelled) { URL.revokeObjectURL(url); return; }
        made.push(url);
        setUrls((current) => ({ ...current, [id]: url }));
      } catch {
        // A file the storage will not serve is a missing file, not a broken
        // task: the tile stays a placeholder.
      }
    }));

    return () => {
      cancelled = true;
      for (const url of made) URL.revokeObjectURL(url);
    };
  }, [imageIds]);

  return (
    <section className="flex flex-col gap-2" data-testid="task-attachments">
      <h3 className="text-sm font-medium">
        {t("tasks.attachments")}
        {imageIds.length > 0 ? ` (${imageIds.length})` : ""}
      </h3>

      {imageIds.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("tasks.attachments.empty")}</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {imageIds.map((id) => (
            <li key={id} data-testid={`task-attachment-${id}`}>
              {urls[id] ? (
                <img
                  src={urls[id]}
                  alt=""
                  className="size-20 rounded-md border object-cover"
                />
              ) : (
                <span className="flex size-20 items-center justify-center rounded-md border text-xs text-muted-foreground">
                  …
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
