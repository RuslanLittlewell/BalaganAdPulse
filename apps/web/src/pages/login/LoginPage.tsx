import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { CenteredPanel } from "@/shared/ui/index.js";
import { TextField } from "@/shared/ui/index.js";
import { Button } from "@/shared/ui/index.js";
import { useAlerts } from "@/shared/ui/index.js";
import { isEmail } from "@/shared/lib/index.js";
import { ApiError } from "@/shared/lib/index.js";
import { t } from "@/shared/config/index.js";
import { TwoFactorStep, lockMessage, useAuth } from "@/features/auth/index.js";
import { BalaganSignature } from "./BalaganSignature.js";

export function LoginPage() {
  const { login } = useAuth();
  const { raise } = useAlerts();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<{ login: string; password: string }>({ defaultValues: { login: "", password: "" } });
  const typed = watch("login").trim();
  const [locked, setLocked] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<string | null>(null);
  const submit = handleSubmit(async ({ login: signIn, password }) => {
    setLocked(null);
    try {
      const outcome = await login({ login: signIn.trim(), password });
      if (outcome) {
        setChallenge(outcome.challenge);
        return;
      }
      navigate(from, { replace: true });
    } catch (error) {
      const lock = lockMessage(error);
      if (lock) setLocked(lock);
      else raise(error instanceof ApiError ? error.message : t("state.error.title"));
    }
  }, (validationErrors) => {
    const message = validationErrors.login?.message ?? validationErrors.password?.message;
    if (message) raise(message);
  });

  if (challenge) {
    return (
      <CenteredPanel title={t("twoFactor.step.title")} above={<BalaganSignature />}>
        <TwoFactorStep
          challenge={challenge}
          onDone={() => navigate(from, { replace: true })}
          onRestart={() => setChallenge(null)}
        />
      </CenteredPanel>
    );
  }

  return (
    <CenteredPanel title={t("auth.login.title")} above={<BalaganSignature />}>
      <form className={"flex flex-col gap-3"} onSubmit={(event) => void submit(event)} noValidate>
        <TextField
          label={t("auth.login.label")}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={errors.login ? true : undefined}
          {...register("login", { validate: (value) => value.trim() !== "" || t("auth.login.required") })}
        />
        <div className="flex flex-col gap-1">
          <TextField
            label={t("auth.password.label")}
            type="password"
            autoComplete="current-password"
            {...register("password")}
          />
          <Link
            to="/password-reset"
            state={{ email: isEmail(typed) ? typed : "" }}
            className="self-end text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {t("auth.forgot")}
          </Link>
        </div>
        {locked ? (
          <div role="alert" className="flex flex-col gap-1 text-sm text-destructive">
            <p>{locked}</p>
            <Link
              to="/password-reset"
              state={{ email: isEmail(typed) ? typed : "" }}
              className="self-start text-foreground underline underline-offset-4"
            >
              {t("auth.locked.recover")}
            </Link>
          </div>
        ) : null}
        <Button type="submit" className="h-9" disabled={isSubmitting} aria-busy={isSubmitting} aria-label={t("auth.login.submit")}>
          {isSubmitting ? (
            <span role="status">
              <LoaderCircle className="size-3 animate-spin" aria-hidden="true" />
              <span className="sr-only">{t("state.loading")}</span>
            </span>
          ) : t("auth.login.submit")}
        </Button>
        <Link
          to="/trial"
          className="self-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {t("auth.trial")}
        </Link>
      </form>
    </CenteredPanel>
  );
}
