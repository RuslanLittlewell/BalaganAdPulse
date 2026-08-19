import { t } from "../../i18n/en.js";
import styles from "./Loader.module.css";

export interface LoaderProps {
  label?: string;
  size?: "sm" | "md";
}

export function Loader({ label, size = "md" }: LoaderProps) {
  return (
    <div className={styles.loader} data-size={size} role="status" aria-live="polite">
      <span className={styles.ring} aria-hidden="true" />
      <span className={styles.label}>{label ?? t("state.loading")}</span>
    </div>
  );
}
