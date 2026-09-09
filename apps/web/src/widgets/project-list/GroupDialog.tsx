import { useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  TextField,
} from "@/shared/ui/index.js";
import { t } from "@/shared/config/index.js";

export interface GroupDialogProps {
  onClose: () => void;
  onCreate: (name: string) => void;
}

export function GroupDialog({ onClose, onCreate }: GroupDialogProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="w-[min(420px,calc(100vw-2rem))] max-w-none">
        <DialogHeader>
          <DialogTitle>{t("projects.group.dialog")}</DialogTitle>
        </DialogHeader>
        <form
          noValidate
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim() === "") { setError(t("projects.group.required")); return; }
            onCreate(name.trim());
          }}
        >
          <TextField
            label={t("projects.group.name")}
            value={name}
            onChange={(event) => { setName(event.target.value); setError(null); }}
            error={error ?? undefined}
            autoFocus
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t("action.cancel")}</Button>
            <Button type="submit">{t("action.create")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
