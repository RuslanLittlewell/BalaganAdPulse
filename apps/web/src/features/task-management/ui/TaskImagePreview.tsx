import { useEffect, useState } from "react";
import { taskImagesApi } from "@/entities/task/index.js";
import { t } from "@/shared/config/index.js";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/index.js";

export interface TaskImagePreviewProps {
  imageId: string | null;
  label: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * One attachment, full size.
 *
 * The bytes are fetched only while the preview is open, and the object URL is
 * revoked when it closes. A URL kept beyond that is valid for exactly one page
 * load, which is what used to leave a reopened task showing broken pictures.
 */
export function TaskImagePreview({ imageId, label, open, onOpenChange }: TaskImagePreviewProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open || !imageId) return;
    let url: string | null = null;
    let cancelled = false;
    setFailed(false);

    taskImagesApi
      .blobUrl(imageId)
      .then((resolved) => {
        if (cancelled) { URL.revokeObjectURL(resolved); return; }
        url = resolved;
        setSrc(resolved);
      })
      .catch(() => { if (!cancelled) setFailed(true); });

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
      setSrc(null);
    };
  }, [open, imageId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[min(900px,calc(100vw-2rem))] max-w-none"
        data-testid="task-image-preview"
      >
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
        </DialogHeader>
        {src ? (
          <img src={src} alt={label} className="max-h-[70vh] w-full rounded-md object-contain" />
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {failed ? t("tasks.editor.uploadFailed") : t("tasks.editor.uploading")}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
