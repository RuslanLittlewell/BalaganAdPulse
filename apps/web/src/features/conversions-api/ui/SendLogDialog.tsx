import { formatDateTime } from "@/shared/lib/index.js";
import { t } from "@/shared/config/index.js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/index.js";
import type { RecentSend } from "../api/conversions.js";

export function SendLogDialog({ sends, onClose }: { sends: readonly RecentSend[]; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(value) => { if (!value) onClose(); }}>
      <DialogContent className="h-auto max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("capi.log.title")}</DialogTitle>
        </DialogHeader>
        {sends.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("capi.log.empty")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("capi.log.lead")}</TableHead>
                <TableHead>{t("capi.log.event")}</TableHead>
                <TableHead>{t("capi.log.time")}</TableHead>
                <TableHead>{t("capi.log.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sends.map((send) => (
                <TableRow key={send.id} data-status={send.status}>
                  <TableCell>{send.leadName}</TableCell>
                  <TableCell>{send.eventName}</TableCell>
                  <TableCell className="tabular-nums">{formatDateTime(send.reachedAt)}</TableCell>
                  <TableCell>
                    <span className={send.status === "FAILED" ? "text-destructive" : undefined}>{t(`capi.status.${send.status}`)}</span>
                    {send.status === "FAILED" && send.lastError && (
                      <span className="block max-w-56 whitespace-normal text-xs text-muted-foreground">{send.lastError}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
