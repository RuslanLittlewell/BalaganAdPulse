import { useTaskImageUrl } from "@/entities/task/index.js";
import { t } from "@/shared/config/index.js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/index.js";

export interface TaskImagePreviewProps {
  imageId: string | null;
  label: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TaskImagePreview({
  imageId,
  label,
  open,
  onOpenChange,
}: TaskImagePreviewProps) {
  const { src, failed } = useTaskImageUrl(open ? imageId : null);

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
          <img
            src={src}
            alt={label}
            className="max-h-[70vh] w-full rounded-md object-contain"
          />
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {failed
              ? t("tasks.editor.uploadFailed")
              : t("tasks.editor.uploading")}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
