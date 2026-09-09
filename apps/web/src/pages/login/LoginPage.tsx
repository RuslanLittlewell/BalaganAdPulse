import { LoaderCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { useLocation, useNavigate } from "react-router-dom";
import { CenteredPanel } from "@/shared/ui/index.js";
import { TextField } from "@/shared/ui/index.js";
import { Button } from "@/shared/ui/index.js";
import { useAlerts } from "@/shared/ui/index.js";
import { isEmail } from "@/shared/lib/index.js";
import { ApiError } from "@/shared/lib/index.js";
import { t } from "@/shared/config/index.js";
import { useAuth } from "@/features/auth/index.js";
import { BalaganSignature } from "./BalaganSignature.js";

export function LoginPage() {
  const { login } = useAuth();
  const { raise } = useAlerts();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ email: string; password: string }>({ defaultValues: { email: "", password: "" } });
  const submit = handleSubmit(async ({ email, password }) => {
    const trimmedEmail = email.trim();
    if (!isEmail(trimmedEmail)) {
      return;
    }
    try {
      await login({ email: trimmedEmail, password });
      navigate(from, { replace: true });
    } catch (error) {
      raise(error instanceof ApiError ? error.message : t("state.error.title"));
    }
  }, (validationErrors) => {
    const message = validationErrors.email?.message ?? validationErrors.password?.message;
    if (message) raise(message);
  });

  return (
    <CenteredPanel title={t("auth.login.title")} above={<BalaganSignature />}>
      <form className={"flex flex-col gap-4"} onSubmit={(event) => void submit(event)} noValidate>
        <TextField
          label={t("auth.email.label")}
          type="email"
          autoComplete="username"
          aria-invalid={errors.email ? true : undefined}
          {...register("email", { validate: (value) => isEmail(value.trim()) || t("auth.email.invalid") })}
        />
        <TextField
          label={t("auth.password.label")}
          type="password"
          autoComplete="current-password"
          {...register("password")}
        />
        <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting} aria-label={t("auth.login.submit")}>
          {isSubmitting ? (
            <span role="status">
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              <span className="sr-only">{t("state.loading")}</span>
            </span>
          ) : t("auth.login.submit")}
        </Button>
      </form>
    </CenteredPanel>
  );
}
