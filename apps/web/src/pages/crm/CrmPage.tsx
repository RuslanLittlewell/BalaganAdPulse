import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { AnimatePresence } from 'motion/react';
import {
  FIXED_LEAD_COLUMNS,
  useCrmEvents,
  useLeadBoards,
  useLeadColumns,
  useLeadFields,
  useLeads,
  useUpdateLead,
  type Lead,
  type LeadAd,
} from "@/entities/lead/index.js";
import { useCan } from "@/features/permissions/index.js";
import { useAuth } from "@/features/auth/index.js";
import { LeadFieldsDialog } from "@/features/lead-field-management/index.js";
import {
  CrmViewChips,
  CrmViewControls,
  PeriodControl,
  pruneState,
  useViewState,
  visibleLeads,
  type FilterContext,
  type Layout,
} from "@/features/lead-view-options/index.js";
import { t } from "@/shared/config/index.js";
import { useModuleMemory } from "@/shared/lib/index.js";
import {
  Button,
  EmptyState,
  FadeContent,
  Tabs,
  useAlerts,
} from "@/shared/ui/index.js";
import { CrmBoard } from "@/widgets/crm-board/index.js";
import { CrmTasks } from "@/widgets/crm-tasks/index.js";
import { CreativePreviewDialog } from "@/widgets/creative-preview/index.js";
import { CreateLeadPanel, LeadSidePanel } from "@/widgets/lead-side-panel/index.js";
import { CreateRecordPanel } from '@/widgets/record-panel/index.js';
import { LeadTable } from "@/widgets/record-table/index.js";

const LAYOUTS = ["board", "table", "tasks"] as const;

function isLayout(value: string | undefined): value is Layout {
  return LAYOUTS.includes(value as Layout);
}

function useBoardChoices(leads: readonly Lead[] | undefined) {
  return useMemo(() => {
    const assignees = new Map<string, string>();
    const tags = new Set<string>();
    for (const lead of leads ?? []) {
      if (lead.assignee) assignees.set(lead.assignee.id, lead.assignee.name);
      for (const tag of lead.tags) tags.add(tag);
    }
    return {
      assignees: [...assignees].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label, "ru")),
      tags: [...tags].sort((a, b) => a.localeCompare(b, "ru")),
    };
  }, [leads]);
}

export function CrmPage() {
  const { data: boards, isLoading, isError } = useLeadBoards();
  const [params, setParams] = useSearchParams();
  const [previewing, setPreviewing] = useState<LeadAd | null>(null);
  const [creatingIn, setCreatingIn] = useState<string | null>(null);
  const [creatingRecord, setCreatingRecord] = useState<'companies' | 'people' | null>(null);
  const [managingFields, setManagingFields] = useState(false);
  const [freshFilter, setFreshFilter] = useState<string | null>(null);

  const { user, role } = useAuth();
  const managesBoard = useCan("create", "lead-board");
  const remembered = useModuleMemory((state) => (user ? state.boards[user.id] : undefined));
  const rememberBoard = useModuleMemory((state) => state.rememberBoard);
  const forgetBoard = useModuleMemory((state) => state.forgetBoard);
  const rememberedLayout = useModuleMemory((state) => (user ? state.crmViews[user.id] : undefined));
  const rememberCrmView = useModuleMemory((state) => state.rememberCrmView);
  const [chosenLayout, setChosenLayout] = useState<Layout | null>(null);
  const selectedLayout: Layout = chosenLayout ?? (isLayout(rememberedLayout) ? rememberedLayout : "board");
  const layout = role === "PARTNER" && selectedLayout === "tasks" ? "board" : selectedLayout;

  const chosen = params.get("board");
  const restorable = !chosen && remembered ? boards?.find((candidate) => candidate.key === remembered) : undefined;
  const board = chosen
    ? boards?.find((candidate) => candidate.key === chosen)
    : restorable ?? (user ? boards?.[0] : undefined);
  const openLeadId = params.get("lead");

  useCrmEvents(board?.key, {}, board?.clientId);
  const updateLead = useUpdateLead(board?.key ?? '');
  const { raise } = useAlerts();

  const { data: leads } = useLeads(board?.key);
  const { data: fields } = useLeadFields(board?.key);
  const { data: columns } = useLeadColumns(board?.key);
  const { view: storedView, change } = useViewState(user?.id, board?.key);
  const view = useMemo(
    () => (fields && columns ? pruneState(storedView, fields, columns) : storedView),
    [storedView, fields, columns],
  );
  const choices = useBoardChoices(leads);
  const shownCount = useMemo(() => visibleLeads(leads ?? [], view, fields ?? []).length, [leads, view, fields]);
  const context: FilterContext = useMemo(
    () => ({ fields: fields ?? [], columns: columns ?? FIXED_LEAD_COLUMNS, assignees: choices.assignees, tags: choices.tags }),
    [fields, columns, choices],
  );

  useEffect(() => {
    setPreviewing(null);
    setCreatingIn(null);
    setCreatingRecord(null);
    setManagingFields(false);
  }, [chosen]);

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

  const openLead = useCallback((lead: Lead) => {
    setCreatingIn(null);
    setCreatingRecord(null);
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (board && !next.get("board")) next.set("board", board.key);
      next.set("lead", lead.id);
      return next;
    });
  }, [board, setParams]);

  const closeLead = useCallback(() => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("lead");
      return next;
    });
  }, [setParams]);

  if (isError) return <EmptyState title={t("crm.loadFailed")} />;
  if (boards && boards.length === 0) return <EmptyState title={t("crm.noBoards")} />;

  const capabilities = board?.capabilities;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border pb-2">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="truncate text-lg font-semibold">{t("crm.nav.leads")}</h1>
          {leads ? (
            <span className="text-xs tabular-nums text-muted-foreground" aria-label={`${t("crm.view.leadCount")}: ${shownCount}`}>
              {shownCount}
            </span>
          ) : null}
        </div>

        <Tabs
          items={[
            { id: "board", label: t("crm.view.board") },
            { id: "table", label: t("crm.view.table") },
            ...(role !== "PARTNER" ? [{ id: "tasks", label: t("crm.view.tasks") }] : []),
          ]}
          activeId={layout}
          onSelect={(id) => {
            if (!isLayout(id)) return;
            setChosenLayout(id);
            if (user) rememberCrmView(user.id, id);
          }}
          ariaLabel={t("crm.view.layout")}
        />

        <span className="flex-1" />

        {board ? <PeriodControl view={view} onChange={(filters) => change({ filters })} /> : null}

        {board ? (
          <CrmViewControls
            view={view}
            context={context}
            canManageFields={managesBoard && (capabilities?.create ?? false)}
            onChange={change}
            onAddFilter={(filter) => { change({ filters: [...view.filters, filter] }); setFreshFilter(filter.id); }}
            onBoardFields={() => setManagingFields(true)}
          />
        ) : null}

        {board && capabilities?.create ? <Button type="button" className="h-8" onClick={() => { closeLead(); setCreatingRecord(null); setCreatingIn('NEW'); }}><Plus aria-hidden className="size-3" />{t("crm.create")}</Button> : null}
      </header>

      {board ? <CrmViewChips view={view} context={context} freshId={freshFilter} fields={fields ?? []} onChange={change} /> : null}

      <div className="relative flex min-h-0 flex-1 overflow-clip">
        <div className="min-h-0 min-w-0 flex-1">
          <FadeContent key={layout} className="h-full">
            {board || isLoading || !user ? (
              layout === "board" ? (
                <CrmBoard
                  boardKey={board?.key}
                  busy={isLoading || !user}
                  capabilities={capabilities}
                  view={view}
                  fields={fields ?? []}
                  selectedId={openLeadId}
                  creatingIn={creatingIn}
                  onCreatingChange={(stage) => { closeLead(); setCreatingRecord(null); setCreatingIn(stage); }}
                  onOpen={openLead}
                />
              ) : layout === "tasks" ? (
                <CrmTasks boardKey={board?.key} view={view} fields={fields ?? []} onOpenLead={openLead} />
              ) : (
                <LeadTable leads={leads ?? []} columns={columns ?? FIXED_LEAD_COLUMNS} fields={fields ?? []} view={view} onOpen={openLead} onSort={(sort) => change({ sort })} />
              )
            ) : (
              <EmptyState title={t("crm.boardUnavailable")} />
            )}
          </FadeContent>
        </div>

        <AnimatePresence mode="wait">
          {board && capabilities?.create && creatingRecord ? <CreateRecordPanel key={`link-${creatingRecord}`} kind={creatingRecord} clientId={board.clientId} onClose={() => setCreatingRecord(null)} onCreated={(id) => {
            const kind = creatingRecord;
            setCreatingRecord(null);
            if (openLeadId) void updateLead.mutateAsync({ id: openLeadId, body: kind === 'people' ? { personId: id } : { companyId: id } }).catch(() => raise(t('crm.form.saveFailed')));
          }} />
            : board && capabilities && openLeadId ? <LeadSidePanel key={`lead-${board.key}`} boardKey={board.key} leadId={openLeadId} capabilities={capabilities} onClose={closeLead} onPreviewCreative={setPreviewing} onCreateRecord={capabilities.create && role !== "PARTNER" ? setCreatingRecord : undefined} />
            : board && capabilities?.create && creatingIn ? <CreateLeadPanel key={`new-${board.key}`} boardKey={board.key} clientId={board.clientId} initialStage={creatingIn} fields={fields ?? []} onCreated={(lead) => { setCreatingIn(null); openLead(lead); }} onClose={() => setCreatingIn(null)} /> : null}
        </AnimatePresence>
      </div>

      {board && capabilities && managingFields ? (
        <LeadFieldsDialog boardKey={board.key} capabilities={capabilities} onClose={() => setManagingFields(false)} />
      ) : null}

      {previewing ? (
        <CreativePreviewDialog ads={[previewing]} initialAdId={previewing.id} onClose={() => setPreviewing(null)} />
      ) : null}
    </div>
  );
}
