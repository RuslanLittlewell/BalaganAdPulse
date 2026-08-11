import type { ReactNode } from "react";
import styles from "./Tabs.module.css";

export interface TabItem {
  id: string;
  label: string;
}

/** An icon button shown inside the active tab. The caller owns the icon and its name. */
export interface TabItemAction {
  icon: ReactNode;
  label: string;
  onSelect: (id: string) => void;
}

export interface TabsProps {
  items: TabItem[];
  activeId?: string;
  onSelect: (id: string) => void;
  action?: ReactNode;
  itemActions?: TabItemAction[];
}

export function Tabs({ items, activeId, onSelect, action, itemActions }: TabsProps) {
  return (
    <div className={styles.strip}>
      <div className={styles.tabs} role="tablist">
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            // A plain wrapper so the icon buttons are siblings of the tab, not nested
            // inside it; `presentation` keeps it out of the tablist's child semantics.
            // Deliberate tradeoff: the item actions still render inside the tablist so they
            // stay visually inside the active tab, making this wrapper a non-tab child of
            // `role="tablist"`. Completing the full ARIA tabs pattern is deferred.
            // `data-active` lives here too: the active underline spans the whole group.
            <div key={item.id} className={styles.item} role="presentation" data-active={active}>
              <button
                type="button"
                role="tab"
                aria-selected={active}
                className={styles.tab}
                data-active={active}
                onClick={() => onSelect(item.id)}
              >
                {item.label}
              </button>
              {active &&
                itemActions?.map((itemAction) => (
                  <button
                    key={itemAction.label}
                    type="button"
                    className={styles.itemAction}
                    aria-label={itemAction.label}
                    onClick={() => itemAction.onSelect(item.id)}
                  >
                    {itemAction.icon}
                  </button>
                ))}
            </div>
          );
        })}
      </div>
      {action != null && <div className={styles.action}>{action}</div>}
    </div>
  );
}
