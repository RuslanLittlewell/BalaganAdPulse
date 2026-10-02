import { useState } from "react";
import { XIcon } from "lucide-react";
import { t } from "@/shared/config/index.js";
import { Button, Input } from "@/shared/ui/index.js";
import SpringCheck from "@/shared/ui/SpringCheck/SpringCheck.js";
import type { ChecklistItem } from "@/entities/task/index.js";

export interface TaskChecklistProps {
  items: readonly ChecklistItem[];
  onAdd: (title: string) => void;
  onChange: (
    item: ChecklistItem,
    change: { title?: string; done?: boolean },
  ) => void;
  onRemove: (item: ChecklistItem) => void;
}

export function TaskChecklist({
  items,
  onAdd,
  onChange,
  onRemove,
}: TaskChecklistProps) {
  const [draft, setDraft] = useState("");

  const ticked = items.filter((item) => item.done).length;

  const addItem = () => {
    const title = draft.trim();
    if (title.length === 0) return;
    onAdd(title);
    setDraft("");
  };

  return (
    <div className="flex flex-col gap-2" data-testid="task-checklist">
      <div className="flex items-center justify-between gap-2">
        {items.length === 0 ? null : (
          <span className="text-xs text-muted-foreground">
            {`${ticked} ${t("tasks.checklist.of")} ${items.length}`}
          </span>
        )}
      </div>

      <ul className="flex flex-col">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-2">
            <SpringCheck
              checked={item.done}
              onChange={(done) => onChange(item, { done })}
              label={<span className="min-w-0 truncate">{item.title}</span>}
              className="min-w-0 flex-1"
              boxSize={18}
              boxRadius={6}
              fontSize={14}
              color="var(--foreground)"
              fillColor="var(--primary)"
              checkColor="var(--primary-foreground)"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("tasks.checklist.remove")}
              onClick={() => onRemove(item)}
            >
              <XIcon />
            </Button>
          </li>
        ))}
      </ul>

      <div className="flex gap-2">
        <Input
          aria-label={t("tasks.checklist.new")}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            addItem();
          }}
        />
        <Button type="button" variant="outline" onClick={addItem}>
          {t("tasks.checklist.add")}
        </Button>
      </div>
    </div>
  );
}
