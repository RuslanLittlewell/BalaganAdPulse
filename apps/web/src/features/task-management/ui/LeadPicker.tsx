import { useQueries } from "@tanstack/react-query";
import { t } from "@/shared/config/index.js";
import { SearchableSelect } from "@/shared/ui/index.js";
import { leadsApi, leadsKey, useLeadBoards } from "@/entities/lead/index.js";

export interface LeadChoice {
  id: string;
  name: string;
  projectId: string;
}

export interface LeadPickerProps {
  value: string;
  boardKey?: string;
  onChange: (choice: LeadChoice) => void;
}

export function LeadPicker({ value, boardKey, onChange }: LeadPickerProps) {
  const { data: boards } = useLeadBoards();
  const shown = boardKey ? (boards ?? []).filter((board) => board.key === boardKey) : boards ?? [];
  const keys = boardKey ? [boardKey] : shown.map((board) => board.key);
  const lists = useQueries({
    queries: keys.map((key) => ({
      queryKey: leadsKey(key),
      queryFn: ({ signal }: { signal: AbortSignal }) => leadsApi.list(key, signal),
    })),
  });
  const labelOf = new Map((boards ?? []).map((board) => [board.key, board.label]));
  const choices = lists.flatMap((list, index) =>
    (list.data ?? []).map((lead) => ({ lead, board: labelOf.get(keys[index] ?? "") ?? "" })));

  return (
    <SearchableSelect
      id="task-lead"
      value={value === "" ? undefined : value}
      onValueChange={(id) => {
        const chosen = choices.find((choice) => choice.lead.id === id)?.lead;
        if (chosen) onChange({ id: chosen.id, name: chosen.name, projectId: chosen.projectId });
      }}
      options={choices.map(({ lead, board }) => ({
        value: lead.id,
        label: boardKey || board === "" ? lead.name : `${lead.name} · ${board}`,
      }))}
      placeholder={t("tasks.form.leadPlaceholder")}
      searchLabel={t("select.search")}
      emptyLabel={t("select.search.empty")}
    />
  );
}
