import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { useCrmEvents, useLeadBoards, type Lead } from "@/entities/lead/index.js";
import { LeadFormDialog } from "@/features/lead-management/index.js";
import { t } from "@/shared/config/index.js";
import { Button, EmptyState, Label } from "@/shared/ui/index.js";
import { CrmBoard } from "@/widgets/crm-board/index.js";

type Editing = { lead?: Lead } | null;

export function CrmPage() {
  const { data: boards, isLoading, isError } = useLeadBoards();
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState<Editing>(null);

  const chosen = params.get("board");
  const board = boards?.find((candidate) => candidate.key === chosen)
    ?? (chosen ? undefined : boards?.[0]);

  useCrmEvents(board?.key);

  useEffect(() => { setEditing(null); }, [chosen]);

  if (isError) return <EmptyState title={t("crm.loadFailed")} />;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <header className="flex shrink-0 flex-wrap items-end justify-between gap-3">
        {(boards ?? []).length > 1 ? (
          <div className="flex min-w-0 flex-col gap-2">
            <Label htmlFor="crm-board">{t("crm.board")}</Label>
            <select
              id="crm-board"
              className="h-9 w-56 rounded-md border border-input bg-transparent pl-3 pr-9 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              value={board?.key ?? ""}
              onChange={(event) => setParams({ board: event.target.value })}
            >
              {(boards ?? []).map((candidate) => (
                <option key={candidate.key} value={candidate.key}>{candidate.label}</option>
              ))}
            </select>
          </div>
        ) : null}

        {board?.capabilities.create ? (
          <Button type="button" onClick={() => setEditing({})}>
            <Plus aria-hidden className="size-4" />
            {t("crm.create")}
          </Button>
        ) : null}
      </header>

      {board || isLoading ? (
        <CrmBoard
          boardKey={board?.key}
          busy={isLoading}
          draggable={board?.capabilities.update ?? false}
          onOpen={(lead) => setEditing({ lead })}
        />
      ) : (
        <EmptyState title={t("crm.boardUnavailable")} />
      )}

      {board && editing ? (
        <LeadFormDialog
          boardKey={board.key}
          capabilities={board.capabilities}
          lead={editing.lead}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}
