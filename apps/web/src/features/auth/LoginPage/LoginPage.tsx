import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { CenteredPanel } from "../../../components/CenteredPanel/CenteredPanel.js";
import { TextField } from "../../../components/TextField/TextField.js";
import { Button } from "../../../components/Button/Button.js";
import { Loader } from "../../../components/Loader/Loader.js";
import { isEmail } from "../../../lib/validation.js";
import { ApiError } from "../../../lib/http.js";
import { t } from "../../../i18n/en.js";
import { useAuth } from "../AuthProvider.js";
import styles from "./LoginPage.module.css";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string>();
  const [failure, setFailure] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFailure(undefined);
    const trimmedEmail = email.trim();
    if (!isEmail(trimmedEmail)) {
      setEmailError(t("auth.email.invalid"));
      return;
    }
    setEmailError(undefined);
    setBusy(true);
    try {
      await login({ email: trimmedEmail, password });
      navigate(from, { replace: true });
    } catch (error) {
      setFailure(error instanceof ApiError ? error.message : t("state.error.title"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <CenteredPanel title={t("auth.login.title")}>
      <form className={styles.form} onSubmit={submit} noValidate>
        {failure != null && <p className={styles.failure} role="alert">{failure}</p>}
        <TextField
          label={t("auth.email.label")}
          type="email"
          autoComplete="username"
          value={email}
          error={emailError}
          onChange={(event) => setEmail(event.target.value)}
        />
        <TextField
          label={t("auth.password.label")}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <Button type="submit" disabled={busy}>{t("auth.login.submit")}</Button>
        {busy && <Loader size="sm" />}
      </form>
      <Link className={styles.link} to="/signup">{t("auth.signup.link")}</Link>
    </CenteredPanel>
  );
}
