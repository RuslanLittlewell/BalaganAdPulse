import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import {
  useDeleteLeadColumn,
  useUpdateLeadColumn,
  type BoardCapabilities,
  type LeadColumn,
} from "@/entities/lead/index.js";
import { t } from "@/shared/config/index.js";
import {
  Button,
  ConfirmDialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  useAlerts,
} from "@/shared/ui/index.js";
import { ColumnNameDialog } from "./ColumnNameDialog.js";

export interface LeadColumnMenuProps {
  boardKey: string;
  column: LeadColumn;
  columns: readonly LeadColumn[];
  leadCount: number;
  capabilities: BoardCapabilities;
}

export function LeadColumnMenu({ boardKey, column, columns, leadCount, capabilities }: LeadColumnMenuProps) {
  const update = useUpdateLeadColumn(boardKey);
  const remove = useDeleteLeadColumn(boardKey);
  const { raise } = useAlerts();
  const [renaming, setRenaming] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const index = columns.findIndex((candidate) => candidate.id === column.id);

  function shift(by: number) {
    update.mutate(
      { id: column.id, body: { position: index + by } },
      { onError: () => raise(t("crm.columns.moveFailed")) },
    );
  }

  async function confirmDelete() {
    try {
      await remove.mutateAsync(column.id);
      setConfirming(false);
    } catch {
      setConfirming(false);
      raise(t("crm.columns.deleteFailed"));
    }
  }

  const description = leadCount > 0
    ? `${t("crm.columns.deleteLeadCount")} ${leadCount}. ${t("crm.columns.deleteMovesLeads")}`
    : t("crm.columns.deleteEmpty");

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            aria-label={`${t("crm.columns.actions")}: ${column.name}`}
          >
            <MoreHorizontal aria-hidden className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {capabilities.update ? (
            <>
              <DropdownMenuItem onSelect={() => setRenaming(true)}>
                {t("crm.columns.rename")}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={index <= 0} onSelect={() => shift(-1)}>
                {t("crm.columns.moveLeft")}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={index >= columns.length - 1} onSelect={() => shift(1)}>
                {t("crm.columns.moveRight")}
              </DropdownMenuItem>
            </>
          ) : null}
          {capabilities.delete ? (
            <DropdownMenuItem variant="destructive" onSelect={() => setConfirming(true)}>
              {t("crm.columns.delete")}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {renaming ? (
        <ColumnNameDialog
          boardKey={boardKey}
          columns={columns}
          column={column}
          onClose={() => setRenaming(false)}
        />
      ) : null}

      <ConfirmDialog
        open={confirming}
        title={t("crm.columns.deleteTitle")}
        description={description}
        confirmLabel={t("crm.columns.deleteConfirm")}
        pending={remove.isPending}
        onConfirm={() => void confirmDelete()}
        onClose={() => setConfirming(false)}
      />
    </>
  );
}
