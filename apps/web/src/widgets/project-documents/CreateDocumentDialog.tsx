import { useState, type FormEvent } from "react";
import { t } from "@/shared/config/index.js";
import { ApiError } from "@/shared/lib/index.js";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  TextField,
} from "@/shared/ui/index.js";
import { useCreateProjectDocument, type ProjectDocument } from "@/entities/project-document/index.js";

export interface CreateDocumentDialogProps {
  projectId: string;
  onCreated: (document: ProjectDocument) => void;
  onClose: () => void;
}

export function CreateDocumentDialog({ projectId, onCreated, onClose }: CreateDocumentDialogProps) {
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | undefined>();
  const create = useCreateProjectDocument(projectId);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (title.trim().length === 0) {
      setError(t("documents.name.required"));
      return;
    }
    create.mutate(title, {
      onSuccess: onCreated,
      onError: (failure) => setError(
        failure instanceof ApiError && failure.status < 500 ? failure.message : t("documents.createFailed"),
      ),
    });
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="h-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("documents.new.title")}</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-3" onSubmit={submit} noValidate>
          <TextField
            label={t("documents.name")}
            value={title}
            maxLength={120}
            autoFocus
            error={error}
            onChange={(event) => {
              setTitle(event.target.value);
              setError(undefined);
            }}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("action.cancel")}
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {t("action.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
