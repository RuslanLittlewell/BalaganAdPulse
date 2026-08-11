import type { ReactNode } from "react";
import styles from "./EmptyState.module.css";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className={styles.wrap}>
      {icon != null && <div className={styles.icon}>{icon}</div>}
      <h2 className={styles.title}>{title}</h2>
      {description != null && <p className={styles.description}>{description}</p>}
      {action != null && <div className={styles.action}>{action}</div>}
    </div>
  );
}
