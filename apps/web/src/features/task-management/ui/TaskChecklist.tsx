import { useState } from "react";
import { XIcon } from "lucide-react";
import { t } from "@/shared/config/index.js";
import { Button, Input, Label } from "@/shared/ui/index.js";
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
        <Label>{t("tasks.checklist")}</Label>
        {items.length === 0 ? null : (
          <span className="text-xs text-muted-foreground">
            {`${ticked} ${t("tasks.checklist.of")} ${items.length}`}
          </span>
        )}
      </div>

      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              id={`checklist-${item.id}`}
              checked={item.done}
              onChange={(event) =>
                onChange(item, { done: event.target.checked })
              }
              className="size-4 shrink-0 accent-primary"
            />
            <label
              htmlFor={`checklist-${item.id}`}
              className={`min-w-0 flex-1 truncate text-sm ${item.done ? "text-muted-foreground line-through" : ""}`}
            >
              {item.title}
            </label>
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
