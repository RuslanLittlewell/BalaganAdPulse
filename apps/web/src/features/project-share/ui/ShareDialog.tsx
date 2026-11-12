import { useState } from "react";
import { useIssueShareLink, useRemoveShareLink, useShareLink } from "@/entities/project/index.js";
import { t } from "@/shared/config/index.js";
import { sharePath } from "@/shared/lib/index.js";
import {
  Button, CopyButton, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Loader,
} from "@/shared/ui/index.js";

type Asking = "replace" | "switchOff";

export interface ShareDialogProps {
  projectId: string;
  open: boolean;
  onClose: () => void;
}

export function ShareDialog({ projectId, open, onClose }: ShareDialogProps) {
  const link = useShareLink(projectId, { enabled: open });
  const issue = useIssueShareLink(projectId);
  const remove = useRemoveShareLink(projectId);
  const [asking, setAsking] = useState<Asking | null>(null);
  const [failed, setFailed] = useState(false);
  const pending = issue.isPending || remove.isPending;
  const address = link.data ? `${window.location.origin}${sharePath(link.data.token)}` : null;

  function close() {
    setAsking(null);
    setFailed(false);
    onClose();
  }

  async function run(change: () => Promise<unknown>) {
    setFailed(false);
    try {
      await change();
      setAsking(null);
    } catch {
      setFailed(true);
    }
  }

  const confirm = (choice: Asking) => run(() => (choice === "replace" ? issue.mutateAsync(true) : remove.mutateAsync()));

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }}>
      <DialogContent className="w-[min(560px,calc(100vw-2rem))] max-w-none">
        <DialogHeader>
          <DialogTitle>{t("share.title")}</DialogTitle>
          <DialogDescription>{t("share.description")}</DialogDescription>
        </DialogHeader>

        {link.isPending ? (
          <Loader label={t("state.loading")} />
        ) : link.isError ? (
          <p role="alert" className="text-sm text-destructive">{t("share.loadFailed")}</p>
        ) : address ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 p-2">
              <code className="min-w-0 flex-1 break-all text-sm">{address}</code>
              <CopyButton value={address} label={t("share.copy")} />
            </div>
            {asking ? (
              <div role="group" aria-label={t(`share.${asking}`)} className="flex flex-col gap-2 rounded-md border border-destructive/40 p-3">
                <p className="text-sm">{t(`share.${asking}.warning`)}</p>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setAsking(null)}>{t("action.cancel")}</Button>
                  <Button type="button" variant="destructive" disabled={pending} onClick={() => void confirm(asking)}>
                    {t(`share.${asking}.confirm`)}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setAsking("replace")}>{t("share.replace")}</Button>
                <Button type="button" variant="outline" onClick={() => setAsking("switchOff")}>{t("share.switchOff")}</Button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex justify-end">
            <Button type="button" disabled={pending} onClick={() => void run(() => issue.mutateAsync(false))}>
              {t("share.create")}
            </Button>
          </div>
        )}

        {failed && <p role="alert" className="text-sm text-destructive">{t("share.failed")}</p>}
      </DialogContent>
    </Dialog>
  );
}
