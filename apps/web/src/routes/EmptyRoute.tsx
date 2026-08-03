import { EmptyState } from "../components/EmptyState/EmptyState.js";
import { t } from "../i18n/en.js";

export function EmptyRoute() {
  return (
    <EmptyState
      icon={<span>📊</span>}
      title={t("clients.empty.title")}
      description={t("clients.empty.description")}
    />
  );
}
