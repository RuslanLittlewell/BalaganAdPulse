import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { CenteredPanel } from "@/shared/ui/index.js";
import { TextField } from "@/shared/ui/index.js";
import { Button } from "@/shared/ui/index.js";
import { Loader } from "@/shared/ui/index.js";
import { isEmail } from "@/shared/lib/index.js";
import { ApiError } from "@/shared/lib/index.js";
import { t } from "@/shared/config/index.js";
import { useAuth } from "@/features/auth/index.js";

const MIN_PASSWORD = 8;

export function SignupPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const { register: field, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ name: string; email: string; password: string; inviteCode: string }>({ defaultValues: { name: "", email: "", password: "", inviteCode: "" } });
  const [failure, setFailure] = useState<string>();
  const submit = handleSubmit(async ({ name, email, password, inviteCode }) => {
    setFailure(undefined);

    const trimmedEmail = email.trim();
    try {
      await register({
        name: name.trim(), email: trimmedEmail, password, inviteCode: inviteCode.trim(),
      });
      navigate("/", { replace: true });
    } catch (error) {
      setFailure(error instanceof ApiError ? error.message : t("state.error.title"));
    }
  });

  return (
    <CenteredPanel title={t("auth.signup.title")}>
      <form className={"flex flex-col gap-4"} onSubmit={(event) => void submit(event)} noValidate>
        {failure != null && <p className={"rounded-md bg-destructive/10 p-3 text-sm text-destructive"} role="alert">{failure}</p>}
        <TextField
          label={t("auth.name.label")}
          autoComplete="name"
          error={errors.name?.message}
          {...field("name", { validate: (value) => Boolean(value.trim()) || t("auth.name.required") })}
        />
        <TextField
          label={t("auth.email.label")}
          type="email"
          autoComplete="username"
          error={errors.email?.message}
          {...field("email", { validate: (value) => isEmail(value.trim()) || t("auth.email.invalid") })}
        />
        <TextField
          label={t("auth.password.label")}
          type="password"
          autoComplete="new-password"
          error={errors.password?.message}
          {...field("password", { minLength: { value: MIN_PASSWORD, message: t("auth.password.tooShort") } })}
        />
        <TextField
          label={t("auth.inviteCode.label")}
          error={errors.inviteCode?.message}
          {...field("inviteCode", { validate: (value) => Boolean(value.trim()) || t("auth.inviteCode.required") })}
        />
        <Button type="submit" disabled={isSubmitting}>{t("auth.signup.submit")}</Button>
        {isSubmitting && <Loader size="sm" />}
      </form>
      <Link className={"text-sm text-primary hover:underline"} to="/login">{t("auth.login.link")}</Link>
    </CenteredPanel>
  );
}
