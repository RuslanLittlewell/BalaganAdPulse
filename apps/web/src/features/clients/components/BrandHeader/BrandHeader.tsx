import { t } from "../../../../i18n/en.js";
import styles from "./BrandHeader.module.css";

export function BrandHeader() {
  return <div className={styles.brand}>{t("brand.title")}</div>;
}
