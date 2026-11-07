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
  const needle = draft.trim().toLocaleLowerCase("ru");
  const matching = offered.filter((tag) => needle === "" || tag.toLocaleLowerCase("ru").includes(needle)).slice(0, 8);

  function add(entered = draft) {
    const tag = entered.trim();
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
    <div className="flex min-w-0 flex-wrap items-center gap-1">
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
              <X aria-hidden className="size-2" />
            </button>
          )}
        </span>
      ))}
      {disabled ? null : adding ? (
        <span className="relative">
          <input
            autoFocus
            aria-label={t("crm.card.tagNew")}
            aria-controls={matching.length > 0 ? listId : undefined}
            aria-autocomplete="list"
            maxLength={TAG_LENGTH_LIMIT}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            onBlur={() => add()}
            className="h-6 w-29 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring"
          />
          {matching.length > 0 ? (
            <ul
              id={listId}
              role="listbox"
              aria-label={t("crm.card.tagSuggestions")}
              className="absolute top-full left-0 z-50 mt-1 max-h-48 min-w-36 overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
            >
              {matching.map((tag) => (
                <li
                  key={tag}
                  role="option"
                  aria-selected={false}
                  className="cursor-pointer truncate rounded-sm px-2 py-1 text-sm hover:bg-accent hover:text-accent-foreground"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => add(tag)}
                >
                  {tag}
                </li>
              ))}
            </ul>
          ) : null}
        </span>
      ) : value.length < TAG_LIMIT ? (
        <button
          type="button"
          aria-label={t("crm.card.tagAdd")}
          className="grid size-6 place-items-center rounded-md border border-primary/40 text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setAdding(true)}
        >
          <Plus aria-hidden className="size-3" />
        </button>
      ) : null}
    </div>
  );
}
