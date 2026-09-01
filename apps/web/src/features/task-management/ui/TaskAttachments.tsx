import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { TASKS_KEY, taskImagesApi } from "@/entities/task/index.js";
import { t } from "@/shared/config/index.js";
import { cn } from "@/shared/lib/index.js";
import { TaskImagePreview } from "./TaskImagePreview.js";

export interface TaskAttachmentsProps {
  imageIds: readonly string[];
  /** Called once the server has accepted the removal, so the description can
   * drop its reference to a file that no longer exists. */
  onRemoved?: (imageId: string) => void;
}

/**
 * The files a task carries, listed in their own block.
 *
 * Each thumbnail is fetched with the member's credentials and shown from an
 * object URL, revoked when the block goes away — the same reason the
 * description's images cannot simply keep a `src`.
 */
export function TaskAttachments({ imageIds, onRemoved }: TaskAttachmentsProps) {
  const queryClient = useQueryClient();
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [previewing, setPreviewing] = useState<{ id: string; label: string } | null>(null);
  // Hidden the moment the member asks, and put back if the server refuses. The
  // prop only catches up once the task is refetched, and a tile that lingers
  // after a delete reads as the delete having failed.
  const [removed, setRemoved] = useState<string[]>([]);
  const [failure, setFailure] = useState<string | null>(null);

  const visible = imageIds.filter((id) => !removed.includes(id));

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

  async function remove(id: string) {
    setFailure(null);
    setRemoved((current) => [...current, id]);
    try {
      await taskImagesApi.remove(id);
      onRemoved?.(id);
      // The board shows an attachment count on every card, and the description
      // has just lost its link to this file.
      await queryClient.invalidateQueries({ queryKey: TASKS_KEY });
    } catch {
      setRemoved((current) => current.filter((candidate) => candidate !== id));
      setFailure(t("tasks.attachments.removeFailed"));
    }
  }

  return (
    <section className="flex flex-col gap-2" data-testid="task-attachments">
      <h3 className="text-sm font-medium">
        {t("tasks.attachments")}
        {visible.length > 0 ? ` (${visible.length})` : ""}
      </h3>

      {visible.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("tasks.attachments.empty")}</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {visible.map((id, index) => {
            const label = `${t("tasks.editor.attachment")} ${index + 1}`;
            return (
              <li key={id} className="group relative" data-testid={`task-attachment-${id}`}>
                <button
                  type="button"
                  aria-label={label}
                  onClick={() => setPreviewing({ id, label })}
                  className={cn(
                    "block size-20 overflow-hidden rounded-md border transition-colors",
                    "hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                >
                  {urls[id] ? (
                    <img src={urls[id]} alt="" className="size-full object-cover" />
                  ) : (
                    <span className="flex size-full items-center justify-center text-xs text-muted-foreground">
                      …
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  aria-label={`${t("tasks.attachments.remove")}: ${label}`}
                  data-testid={`task-attachment-remove-${id}`}
                  // Always reachable by keyboard and always present for a
                  // pointer; only the paint waits for hover, so the control is
                  // not hidden from anyone navigating without a mouse.
                  className={cn(
                    "absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full",
                    "bg-destructive text-white shadow-sm transition-opacity",
                    "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                  onClick={(event) => {
                    // The tile underneath opens the preview; removing must not
                    // also open the thing being removed.
                    event.stopPropagation();
                    void remove(id);
                  }}
                >
                  <X aria-hidden className="size-3" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {failure ? <p role="alert" className="text-xs text-destructive">{failure}</p> : null}

      <TaskImagePreview
        imageId={previewing?.id ?? null}
        label={previewing?.label ?? ""}
        open={previewing !== null}
        onOpenChange={(open) => { if (!open) setPreviewing(null); }}
      />
    </section>
  );
}
