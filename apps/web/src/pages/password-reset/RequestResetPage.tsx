import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation } from "react-router-dom";
import { Button, CenteredPanel, TextField, useAlerts } from "@/shared/ui/index.js";
import { ApiError, isEmail } from "@/shared/lib/index.js";
import { t } from "@/shared/config/index.js";
import { passwordResetApi } from "@/features/auth/index.js";

const BACK_LINK = "self-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline";

export function RequestResetPage() {
  const { raise } = useAlerts();
  const typed = (useLocation().state as { email?: string } | null)?.email ?? "";
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ email: string }>({
    defaultValues: { email: typed },
  });

  const submit = handleSubmit(async ({ email }) => {
    try {
      await passwordResetApi.request(email.trim());
      setSent(true);
    } catch (error) {
      raise(error instanceof ApiError && error.status === 503
        ? t("auth.recover.unavailable")
        : t("state.error.title"));
    }
  });

  return (
    <CenteredPanel title={t("auth.recover.title")}>
      {sent ? (
        <div className="flex flex-col gap-4">
          <p role="status" className="text-sm text-muted-foreground">{t("auth.recover.sent")}</p>
          <Link to="/login" className={BACK_LINK}>{t("auth.backToLogin")}</Link>
        </div>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={(event) => void submit(event)} noValidate>
          <p className="text-sm text-muted-foreground">{t("auth.recover.hint")}</p>
          <TextField
            label={t("auth.email.label")}
            type="email"
            autoComplete="username"
            error={errors.email?.message}
            {...register("email", { validate: (value) => isEmail(value.trim()) || t("auth.email.invalid") })}
          />
          <Button type="submit" className="h-11" disabled={isSubmitting} aria-busy={isSubmitting}>
            {t("auth.recover.submit")}
          </Button>
          <Link to="/login" className={BACK_LINK}>{t("auth.backToLogin")}</Link>
        </form>
      )}
    </CenteredPanel>
  );
}
