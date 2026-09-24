import { useId, useState, type KeyboardEvent } from "react";
import { Plus, X } from "lucide-react";
import { t } from "@/shared/config/index.js";

export const TAG_LIMIT = 10;
export const TAG_LENGTH_LIMIT = 30;

export interface LeadTagsProps {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions: readonly string[];
  disabled?: boolean;
}

export function LeadTags({ value, onChange, suggestions, disabled = false }: LeadTagsProps) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const listId = useId();
  const taken = new Set(value.map((tag) => tag.toLowerCase()));
  const offered = suggestions.filter((tag) => !taken.has(tag.toLowerCase()));

  function add() {
    const tag = draft.trim();
    if (tag && tag.length <= TAG_LENGTH_LIMIT && !taken.has(tag.toLowerCase()) && value.length < TAG_LIMIT) {
      onChange([...value, tag]);
    }
    setDraft("");
    setAdding(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      add();
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setDraft("");
      setAdding(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      {value.map((tag) => (
        <span key={tag} className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
          {tag}
          {disabled ? null : (
            <button
              type="button"
              aria-label={`${t("crm.card.tagRemove")} ${tag}`}
              className="rounded-sm opacity-70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => onChange(value.filter((held) => held !== tag))}
            >
              <X aria-hidden className="size-3" />
            </button>
          )}
        </span>
      ))}
      {disabled ? null : adding ? (
        <>
          <input
            autoFocus
            aria-label={t("crm.card.tagNew")}
            list={listId}
            maxLength={TAG_LENGTH_LIMIT}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            onBlur={add}
            className="h-7 w-36 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring"
          />
          <datalist id={listId} data-testid="tag-suggestions">
            {offered.map((tag) => <option key={tag} value={tag} />)}
          </datalist>
        </>
      ) : value.length < TAG_LIMIT ? (
        <button
          type="button"
          aria-label={t("crm.card.tagAdd")}
          className="grid size-7 place-items-center rounded-md border border-primary/40 text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setAdding(true)}
        >
          <Plus aria-hidden className="size-4" />
        </button>
      ) : null}
    </div>
  );
}
