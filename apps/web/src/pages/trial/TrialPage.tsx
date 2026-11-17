import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate } from "react-router-dom";
import { Button, CenteredPanel, TextField, useAlerts } from "@/shared/ui/index.js";
import { ApiError, hasSession, isEmail } from "@/shared/lib/index.js";
import { t } from "@/shared/config/index.js";
import { trialApi } from "@/features/auth/index.js";

const BACK_LINK = "self-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline";
const MIN_PASSWORD = 8;

interface TrialValues {
  organizationName: string;
  name: string;
  email: string;
  password: string;
  confirmation: string;
}

export function TrialPage() {
  const { raise } = useAlerts();
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, getValues, formState: { errors, isSubmitting } } = useForm<TrialValues>({
    defaultValues: { organizationName: "", name: "", email: "", password: "", confirmation: "" },
  });

  if (hasSession()) return <Navigate to="/" replace />;

  const submit = handleSubmit(async ({ organizationName, name, email, password }) => {
    try {
      await trialApi.request({
        organizationName: organizationName.trim(),
        name: name.trim(),
        email: email.trim(),
        password,
      });
      setSent(true);
    } catch (error) {
      raise(error instanceof ApiError && error.status === 503
        ? t("trial.unavailable")
        : t("state.error.title"));
    }
  });

  return (
    <CenteredPanel title={t("trial.title")}>
      {sent ? (
        <div className="flex flex-col gap-3">
          <p role="status" className="text-sm text-muted-foreground">{t("trial.sent")}</p>
          <Link to="/login" className={BACK_LINK}>{t("auth.backToLogin")}</Link>
        </div>
      ) : (
        <form className="flex flex-col gap-3" onSubmit={(event) => void submit(event)} noValidate>
          <p className="text-sm text-muted-foreground">{t("trial.hint")}</p>
          <TextField
            label={t("trial.organization")}
            autoComplete="organization"
            error={errors.organizationName?.message}
            {...register("organizationName", {
              validate: (value) => value.trim() !== "" || t("trial.organization.required"),
            })}
          />
          <TextField
            label={t("trial.name")}
            autoComplete="name"
            error={errors.name?.message}
            {...register("name", { validate: (value) => value.trim() !== "" || t("trial.name.required") })}
          />
          <TextField
            label={t("auth.email.label")}
            type="email"
            autoComplete="username"
            error={errors.email?.message}
            {...register("email", { validate: (value) => isEmail(value.trim()) || t("auth.email.invalid") })}
          />
          <TextField
            label={t("trial.password")}
            type="password"
            autoComplete="new-password"
            error={errors.password?.message}
            {...register("password", {
              required: t("registration.password.required"),
              minLength: { value: MIN_PASSWORD, message: t("auth.password.tooShort") },
            })}
          />
          <TextField
            label={t("registration.password.confirm")}
            type="password"
            autoComplete="new-password"
            error={errors.confirmation?.message}
            {...register("confirmation", {
              required: t("registration.password.confirmRequired"),
              validate: (value) => value === getValues("password") || t("registration.password.mismatch"),
            })}
          />
          <Button type="submit" className="h-9" disabled={isSubmitting} aria-busy={isSubmitting}>
            {t("trial.submit")}
          </Button>
          <Link to="/login" className={BACK_LINK}>{t("auth.backToLogin")}</Link>
        </form>
      )}
    </CenteredPanel>
  );
}
