import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { useCrmEvents, useLeadBoards, type Lead, type LeadAd } from "@/entities/lead/index.js";
import { LeadFormDialog } from "@/features/lead-management/index.js";
import { useAuth } from "@/features/auth/index.js";
import { t } from "@/shared/config/index.js";
import { useModuleMemory } from "@/shared/lib/index.js";
import {
  Button,
  EmptyState,
  FadeContent,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/index.js";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/ui/tabs.js";
import { CrmBoard } from "@/widgets/crm-board/index.js";
import { CrmCalendar } from "@/widgets/crm-calendar/index.js";
import { CreativePreviewDialog } from "@/widgets/creative-preview/index.js";

type Editing = { lead?: Lead } | null;

const VIEWS = ["board", "calendar"] as const;

type View = (typeof VIEWS)[number];

function isView(value: string | undefined): value is View {
  return VIEWS.includes(value as View);
}

export function CrmPage() {
  const { data: boards, isLoading, isError } = useLeadBoards();
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState<Editing>(null);
  const [previewing, setPreviewing] = useState<LeadAd | null>(null);

  const { user } = useAuth();
  const remembered = useModuleMemory((state) => (user ? state.boards[user.id] : undefined));
  const rememberBoard = useModuleMemory((state) => state.rememberBoard);
  const forgetBoard = useModuleMemory((state) => state.forgetBoard);

  const rememberedView = useModuleMemory((state) => (user ? state.crmViews[user.id] : undefined));
  const rememberCrmView = useModuleMemory((state) => state.rememberCrmView);
  const [chosenView, setChosenView] = useState<View | null>(null);
  const view: View = chosenView ?? (isView(rememberedView) ? rememberedView : "board");

  const chosen = params.get("board");
  const restorable = !chosen && remembered ? boards?.find((candidate) => candidate.key === remembered) : undefined;
  const board = chosen
    ? boards?.find((candidate) => candidate.key === chosen)
    : restorable ?? (user ? boards?.[0] : undefined);

  useCrmEvents(board?.key);

  useEffect(() => { setEditing(null); setPreviewing(null); }, [chosen]);

  useEffect(() => {
    if (!user || !boards) return;
    if (chosen) {
      if (board) rememberBoard(user.id, board.key);
    } else if (restorable) {
      setParams({ board: restorable.key }, { replace: true });
    } else if (remembered) {
      forgetBoard(user.id);
    }
  }, [user, boards, chosen, board, restorable, remembered, rememberBoard, forgetBoard, setParams]);

  if (isError) return <EmptyState title={t("crm.loadFailed")} />;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <header className="flex shrink-0 flex-wrap items-end justify-between gap-3">
        {(boards ?? []).length > 1 ? (
          <div className="flex min-w-0 flex-col gap-2">
            <Label htmlFor="crm-board">{t("crm.board")}</Label>
            <Select value={board?.key ?? ""} onValueChange={(next) => setParams({ board: next })}>
              <SelectTrigger id="crm-board" className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(boards ?? []).map((candidate) => (
                  <SelectItem key={candidate.key} value={candidate.key}>{candidate.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <Tabs
          value={view}
          onValueChange={(value) => {
            if (!isView(value)) return;
            setChosenView(value);
            if (user) rememberCrmView(user.id, value);
          }}
        >
          <TabsList>
            <TabsTrigger value="board">{t("crm.view.board")}</TabsTrigger>
            <TabsTrigger value="calendar">{t("crm.view.calendar")}</TabsTrigger>
          </TabsList>
        </Tabs>

        {board?.capabilities.create ? (
          <Button type="button" onClick={() => setEditing({})}>
            <Plus aria-hidden className="size-4" />
            {t("crm.create")}
          </Button>
        ) : null}
      </header>

      <div className="min-h-0 flex-1">
        <FadeContent key={view} className="h-full">
          {board || isLoading || !user ? (
            view === "board" ? (
              <CrmBoard
                boardKey={board?.key}
                busy={isLoading || !user}
                draggable={board?.capabilities.update ?? false}
                capabilities={board?.capabilities}
                onOpen={(lead) => setEditing({ lead })}
              />
            ) : (
              <CrmCalendar
                boardKey={board?.key}
                busy={isLoading || !user}
                onOpen={(lead) => setEditing({ lead })}
              />
            )
          ) : (
            <EmptyState title={t("crm.boardUnavailable")} />
          )}
        </FadeContent>
      </div>

      {board && editing ? (
        <LeadFormDialog
          boardKey={board.key}
          capabilities={board.capabilities}
          lead={editing.lead}
          onClose={() => setEditing(null)}
          onPreviewCreative={setPreviewing}
        />
      ) : null}

      {previewing ? (
        <CreativePreviewDialog
          ads={[previewing]}
          initialAdId={previewing.id}
          onClose={() => setPreviewing(null)}
        />
      ) : null}
    </div>
  );
}
