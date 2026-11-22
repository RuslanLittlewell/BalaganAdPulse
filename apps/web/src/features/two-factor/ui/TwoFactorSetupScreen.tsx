import { t } from "@/shared/config/index.js";
import { Button, CenteredPanel } from "@/shared/ui/index.js";
import { useAuth } from "@/features/auth/index.js";
import { useTwoFactorChanges } from "../api/api.js";
import { TwoFactorEnrolment } from "./TwoFactorEnrolment.js";

export function TwoFactorSetupScreen() {
  const { logout } = useAuth();
  const { refresh } = useTwoFactorChanges();
  return (
    <CenteredPanel title={t("twoFactor.setup.title")}>
      <div className="flex flex-col gap-4">
        <p className="text-sm">{t("twoFactor.setup.hint")}</p>
        <TwoFactorEnrolment onDone={() => void refresh()} />
        <Button type="button" variant="ghost" onClick={() => void logout()}>{t("auth.logout")}</Button>
      </div>
    </CenteredPanel>
  );
}
