import type { ReactNode } from "react";
import styles from "./AppShell.module.css";

export interface AppShellProps {
  sidebar: ReactNode;
  children: ReactNode;
}

export function AppShell({ sidebar, children }: AppShellProps) {
  return (
    <div className={styles.shell}>
      {sidebar}
      <main className={styles.main}>{children}</main>
    </div>
  );
}
