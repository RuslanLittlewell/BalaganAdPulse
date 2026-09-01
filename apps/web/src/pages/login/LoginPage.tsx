import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { CenteredPanel } from "@/shared/ui/index.js";
import { TextField } from "@/shared/ui/index.js";
import { Button } from "@/shared/ui/index.js";
import { Loader } from "@/shared/ui/index.js";
import { isEmail } from "@/shared/lib/index.js";
import { ApiError } from "@/shared/lib/index.js";
import { t } from "@/shared/config/index.js";
import { useAuth } from "@/features/auth/index.js";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ email: string; password: string }>({ defaultValues: { email: "", password: "" } });
  const [failure, setFailure] = useState<string>();
  const submit = handleSubmit(async ({ email, password }) => {
    setFailure(undefined);
    const trimmedEmail = email.trim();
    if (!isEmail(trimmedEmail)) {
      return;
    }
    try {
      await login({ email: trimmedEmail, password });
      navigate(from, { replace: true });
    } catch (error) {
      setFailure(error instanceof ApiError ? error.message : t("state.error.title"));
    }
  });

  return (
    <CenteredPanel title={t("auth.login.title")}>
      <form className={"flex flex-col gap-4"} onSubmit={(event) => void submit(event)} noValidate>
        {failure != null && <p className={"rounded-md bg-destructive/10 p-3 text-sm text-destructive"} role="alert">{failure}</p>}
        <TextField
          label={t("auth.email.label")}
          type="email"
          autoComplete="username"
          error={errors.email?.message}
          {...register("email", { validate: (value) => isEmail(value.trim()) || t("auth.email.invalid") })}
        />
        <TextField
          label={t("auth.password.label")}
          type="password"
          autoComplete="current-password"
          {...register("password")}
        />
        <Button type="submit" disabled={isSubmitting}>{t("auth.login.submit")}</Button>
        {isSubmitting && <Loader size="sm" />}
      </form>
      <Link className={"text-sm text-primary hover:underline"} to="/signup">{t("auth.signup.link")}</Link>
    </CenteredPanel>
  );
}
