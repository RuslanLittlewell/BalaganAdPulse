import type { ReactNode } from "react";
import styles from "./Sidebar.module.css";

export interface SidebarProps {
  header?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
  footer?: ReactNode;
}

export function Sidebar({ header, children, action, footer }: SidebarProps) {
  return (
    <aside className={styles.sidebar}>
      {header != null && <div data-region="header">{header}</div>}
      <div className={styles.scroll} data-region="list">
        {children}
      </div>
      {action != null && (
        <div className={styles.action} data-region="action">
          {action}
        </div>
      )}
      {footer != null && (
        <div className={styles.footer} data-region="footer">
          {footer}
        </div>
      )}
    </aside>
  );
}
