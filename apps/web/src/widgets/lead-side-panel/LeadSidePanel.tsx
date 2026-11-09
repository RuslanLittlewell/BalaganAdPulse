import { useEffect, useState } from "react";
import { useLeads, type BoardCapabilities, type LeadAd } from "@/entities/lead/index.js";
import { LeadActivityTab, LeadFilesTab, LeadNotesTab, LeadSourceSection } from "@/features/lead-management/index.js";
import { openTaskCount, useLeadTasks, useTaskEvents } from "@/entities/task/index.js";
import { isCustomer } from "@adpulse/access-policy";
import { useAuth } from "@/features/auth/index.js";
import { useCan } from "@/features/permissions/index.js";
import { t } from "@/shared/config/index.js";
import { SidePanel, Tabs } from "@/shared/ui/index.js";
import { FieldsTab } from "./FieldsTab.js";
import { LeadTasksTab } from "./LeadTasksTab.js";
import { PanelHeader } from "./PanelHeader.js";
import { useSaveLead } from "./useSaveLead.js";

export interface LeadSidePanelProps {
  boardKey: string;
  leadId: string;
  capabilities: BoardCapabilities;
  onClose: () => void;
  onPreviewCreative?: (ad: LeadAd) => void;
  onCreateRecord?: (kind: 'companies' | 'people') => void;
}

type Tab = "fields" | "tasks" | "notes" | "activity" | "files" | "info";

export function LeadSidePanel({ boardKey, leadId, capabilities, onClose, onPreviewCreative, onCreateRecord }: LeadSidePanelProps) {
  const { data: leads } = useLeads(boardKey);
  const lead = leads?.find((candidate) => candidate.id === leadId);
  const [tab, setTab] = useState<Tab>("fields");

  useEffect(() => { setTab("fields"); }, [leadId]);

  if (!lead) return null;

  return (
    <PanelBody
      boardKey={boardKey}
      lead={lead}
      capabilities={capabilities}
      tab={tab}
      onTab={setTab}
      onClose={onClose}
      onPreviewCreative={onPreviewCreative}
      onCreateRecord={onCreateRecord}
    />
  );
}

function PanelBody({ boardKey, lead, capabilities, tab, onTab, onClose, onPreviewCreative, onCreateRecord }: {
  boardKey: string;
  lead: NonNullable<ReturnType<typeof useLeads>["data"]>[number];
  capabilities: BoardCapabilities;
  tab: Tab;
  onTab: (tab: Tab) => void;
  onClose: () => void;
  onPreviewCreative?: (ad: LeadAd) => void;
  onCreateRecord?: (kind: 'companies' | 'people') => void;
}) {
  const save = useSaveLead(boardKey, lead);
  const { role } = useAuth();
  const readsTasks = useCan("read", "task") && role !== null && !isCustomer(role);
  const tasks = useLeadTasks(readsTasks ? lead.id : undefined);
  useTaskEvents();
  const shown: Tab = (tab === "info" && !lead.metaSource) || (tab === "tasks" && !readsTasks) ? "fields" : tab;
  const open = openTaskCount(tasks.data ?? []);

  return (
    <SidePanel label={lead.name} testId="lead-side-panel" wide onClose={onClose}>
      <PanelHeader boardKey={boardKey} lead={lead} capabilities={capabilities} save={save} onClose={onClose} />
      <div className="shrink-0 px-4 pt-3">
        <Tabs
          items={[
            { id: "fields", label: t("crm.panel.fields") },
            ...(readsTasks ? [{ id: "tasks", label: open > 0 ? `${t("crm.panel.tasks")} · ${open}` : t("crm.panel.tasks") }] : []),
            { id: "notes", label: t("crm.card.notes") },
            { id: "activity", label: t("crm.card.activity") },
            { id: "files", label: t("crm.card.files") },
            ...(lead.metaSource ? [{ id: "info", label: t("crm.card.info") }] : []),
          ]}
          activeId={shown}
          onSelect={(id) => onTab(id as Tab)}
          ariaLabel={t("crm.card.tabs")}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {shown === "fields" ? (
          <FieldsTab boardKey={boardKey} lead={lead} editable={capabilities.update} save={save} onCreateRecord={onCreateRecord} />
        ) : shown === "tasks" ? (
          <LeadTasksTab lead={lead} tasks={tasks.data} isLoading={tasks.isLoading} isError={tasks.isError} />
        ) : shown === "notes" ? (
          <LeadNotesTab boardKey={boardKey} leadId={lead.id} editable={capabilities.update} />
        ) : shown === "activity" ? (
          <LeadActivityTab boardKey={boardKey} leadId={lead.id} />
        ) : shown === "files" ? (
          <LeadFilesTab boardKey={boardKey} leadId={lead.id} editable={capabilities.update} />
        ) : lead.metaSource ? (
          <LeadSourceSection
            source={lead.metaSource}
            onPreview={lead.ad && onPreviewCreative ? () => onPreviewCreative(lead.ad!) : undefined}
          />
        ) : null}
      </div>
    </SidePanel>
  );
}
