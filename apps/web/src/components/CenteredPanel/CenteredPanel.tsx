import type { ReactNode } from "react";
import styles from "./CenteredPanel.module.css";

export interface CenteredPanelProps {
  title: string;
  children: ReactNode;
}

/** A card centred on an empty screen. Knows nothing about authentication —
 * a "not found" page will want the same frame. */
export function CenteredPanel({ title, children }: CenteredPanelProps) {
  return (
    <div className={styles.screen}>
      <section className={styles.panel}>
        <h1 className={styles.title}>{title}</h1>
        {children}
      </section>
    </div>
  );
}
