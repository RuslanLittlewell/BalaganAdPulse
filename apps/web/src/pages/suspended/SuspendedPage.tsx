import { useAuth } from "@/features/auth/index.js";
import { t } from "@/shared/config/index.js";
import { Button, CenteredPanel } from "@/shared/ui/index.js";

export function SuspendedPage() {
  const { organization, logout } = useAuth();
  return (
    <CenteredPanel title={t("suspended.title")}>
      <div className="flex flex-col gap-3">
        {organization && <p className="font-medium">{organization.name}</p>}
        <p className="text-sm text-muted-foreground">{t("suspended.description")}</p>
        <Button type="button" variant="outline" onClick={() => void logout()}>{t("auth.logout")}</Button>
      </div>
    </CenteredPanel>
  );
}
