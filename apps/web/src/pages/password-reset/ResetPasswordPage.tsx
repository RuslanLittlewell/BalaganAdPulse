import { useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button, CenteredPanel, TextField, useAlerts } from "@/shared/ui/index.js";
import { ApiError } from "@/shared/lib/index.js";
import { t } from "@/shared/config/index.js";
import { passwordResetApi, useAuth } from "@/features/auth/index.js";

const MIN_PASSWORD = 8;

interface ResetValues {
  password: string;
  confirmation: string;
}

export function ResetPasswordPage() {
  const token = useParams<{ token: string }>().token ?? "";
  const { resetPassword } = useAuth();
  const { raise } = useAlerts();
  const navigate = useNavigate();
  const [spent, setSpent] = useState(false);
  const link = useQuery({
    queryKey: ["password-reset", token],
    queryFn: () => passwordResetApi.check(token).then(() => true),
    staleTime: Infinity,
  });
  const { register, handleSubmit, getValues, formState: { errors, isSubmitting } } = useForm<ResetValues>({
    defaultValues: { password: "", confirmation: "" },
  });

  const submit = handleSubmit(async ({ password }) => {
    try {
      await resetPassword(token, password);
      navigate("/", { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) setSpent(true);
      else raise(t("state.error.title"));
    }
  });

  if (link.isPending) {
    return (
      <CenteredPanel title={t("auth.reset.title")}>
        <p role="status" className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          {t("auth.reset.checking")}
        </p>
      </CenteredPanel>
    );
  }

  if (link.isError || spent) {
    return (
      <CenteredPanel title={t("auth.reset.title")}>
        <div className="flex flex-col gap-4">
          <p role="alert" className="text-sm text-muted-foreground">{t("auth.reset.invalid")}</p>
          <Button asChild className="h-11">
            <Link to="/password-reset">{t("auth.reset.again")}</Link>
          </Button>
        </div>
      </CenteredPanel>
    );
  }

  return (
    <CenteredPanel title={t("auth.reset.title")}>
      <form className="flex flex-col gap-4" onSubmit={(event) => void submit(event)} noValidate>
        <TextField
          label={t("auth.reset.password")}
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
        <Button type="submit" className="h-11" disabled={isSubmitting} aria-busy={isSubmitting}>
          {t("auth.reset.submit")}
        </Button>
      </form>
    </CenteredPanel>
  );
}
