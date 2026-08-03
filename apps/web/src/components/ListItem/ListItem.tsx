import type { ReactNode } from "react";
import styles from "./ListItem.module.css";

export interface ListItemProps {
  selected?: boolean;
  leading?: ReactNode;
  onClick?: () => void;
  children: ReactNode;
}

export function ListItem({ selected = false, leading, onClick, children }: ListItemProps) {
  return (
    <button
      type="button"
      className={styles.item}
      data-selected={selected}
      onClick={onClick}
    >
      {leading != null && <span className={styles.leading}>{leading}</span>}
      <span className={styles.content}>{children}</span>
    </button>
  );
}
