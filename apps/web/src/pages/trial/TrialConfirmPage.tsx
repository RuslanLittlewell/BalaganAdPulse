import { useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button, CenteredPanel, useAlerts } from "@/shared/ui/index.js";
import { ApiError } from "@/shared/lib/index.js";
import { t } from "@/shared/config/index.js";
import { useAuth } from "@/features/auth/index.js";

export function TrialConfirmPage() {
  const token = useParams<{ token: string }>().token ?? "";
  const { confirmTrial } = useAuth();
  const { raise } = useAlerts();
  const navigate = useNavigate();
  const [dead, setDead] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    confirmTrial(token).then(
      () => navigate("/", { replace: true }),
      (error: unknown) => {
        if (error instanceof ApiError && error.status === 404) setDead(true);
        else raise(t("state.error.title"));
      },
    );
  }, [token, confirmTrial, navigate, raise]);

  if (dead) {
    return (
      <CenteredPanel title={t("trial.confirm.title")}>
        <div className="flex flex-col gap-3">
          <p role="alert" className="text-sm text-muted-foreground">{t("trial.confirm.invalid")}</p>
          <Button asChild className="h-9">
            <Link to="/trial">{t("trial.confirm.again")}</Link>
          </Button>
        </div>
      </CenteredPanel>
    );
  }

  return (
    <CenteredPanel title={t("trial.confirm.title")}>
      <p role="status" className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-3 animate-spin" aria-hidden="true" />
        {t("trial.confirm.working")}
      </p>
    </CenteredPanel>
  );
}
