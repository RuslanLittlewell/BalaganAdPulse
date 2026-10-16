import { useEffect, useState, type FormEvent } from "react";
import {
  useDeleteOrganization,
  type PlatformOrganization,
} from "@/entities/platform-organization/index.js";
import { t } from "@/shared/config/index.js";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  TextField,
} from "@/shared/ui/index.js";

export interface DeleteOrganizationDialogProps {
  organization: PlatformOrganization;
  open: boolean;
  onClose: () => void;
}

export function DeleteOrganizationDialog({ organization, open, onClose }: DeleteOrganizationDialogProps) {
  const remove = useDeleteOrganization();
  const [typed, setTyped] = useState("");
  const [failure, setFailure] = useState<string | null>(null);
  const confirmed = typed === organization.name;

  useEffect(() => {
    if (!open) return;
    setTyped("");
    setFailure(null);
  }, [open]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!confirmed) return;
    setFailure(null);
    try {
      await remove.mutateAsync(organization.id);
      onClose();
    } catch {
      setFailure(t("platform.delete.failed"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="w-[min(480px,calc(100vw-2rem))] max-w-none">
        <DialogHeader>
          <DialogTitle>{t("platform.delete.title")}</DialogTitle>
          <DialogDescription>{t("platform.delete.description")}</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" noValidate onSubmit={(event) => void submit(event)}>
          <p className="text-sm font-medium">{organization.name}</p>
          <TextField
            label={t("platform.delete.confirmLabel")}
            value={typed}
            autoComplete="off"
            onChange={(event) => setTyped(event.target.value)}
          />
          {failure && <p role="alert" className="text-sm text-destructive">{failure}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t("action.cancel")}</Button>
            <Button type="submit" variant="destructive" disabled={!confirmed || remove.isPending}>
              {t("platform.delete.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
