import { useState } from "react";
import type { ChecklistItem } from "@/entities/task/index.js";

let fallbackId = 0;

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    fallbackId += 1;
    return `draft-${fallbackId}`;
  }
}

export interface ChecklistDraft {
  items: ChecklistItem[];
  add: (title: string) => void;
  change: (
    item: ChecklistItem,
    change: { title?: string; done?: boolean },
  ) => void;
  remove: (item: ChecklistItem) => void;
  clear: () => void;
}

export function useChecklistDraft(
  initial: readonly ChecklistItem[] = [],
): ChecklistDraft {
  const [items, setItems] = useState<ChecklistItem[]>(() => [...initial]);

  return {
    items,
    add: (title) =>
      setItems((held) => [
        ...held,
        { id: newId(), title, done: false, position: held.length },
      ]),
    change: (item, change) =>
      setItems((held) =>
        held.map((candidate) =>
          candidate.id === item.id ? { ...candidate, ...change } : candidate,
        ),
      ),
    remove: (item) =>
      setItems((held) =>
        held
          .filter((candidate) => candidate.id !== item.id)
          .map((candidate, index) => ({ ...candidate, position: index })),
      ),
    clear: () => setItems([]),
  };
}
