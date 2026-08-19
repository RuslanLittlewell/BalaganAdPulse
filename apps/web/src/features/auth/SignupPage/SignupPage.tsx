import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CenteredPanel } from "../../../components/CenteredPanel/CenteredPanel.js";
import { TextField } from "../../../components/TextField/TextField.js";
import { Button } from "../../../components/Button/Button.js";
import { Loader } from "../../../components/Loader/Loader.js";
import { isEmail } from "../../../lib/validation.js";
import { ApiError } from "../../../lib/http.js";
import { t } from "../../../i18n/en.js";
import { useAuth } from "../AuthProvider.js";
import styles from "../LoginPage/LoginPage.module.css";

const MIN_PASSWORD = 8;

export function SignupPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFailure(undefined);

    const trimmedEmail = email.trim();
    const next: Record<string, string> = {};
    if (name.trim() === "") next.name = t("auth.name.required");
    if (!isEmail(trimmedEmail)) next.email = t("auth.email.invalid");
    if (password.length < MIN_PASSWORD) next.password = t("auth.password.tooShort");
    if (inviteCode.trim() === "") next.inviteCode = t("auth.inviteCode.required");
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    try {
      await register({
        name: name.trim(), email: trimmedEmail, password, inviteCode: inviteCode.trim(),
      });
      navigate("/", { replace: true });
    } catch (error) {
      setFailure(error instanceof ApiError ? error.message : t("state.error.title"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <CenteredPanel title={t("auth.signup.title")}>
      <form className={styles.form} onSubmit={submit} noValidate>
        {failure != null && <p className={styles.failure} role="alert">{failure}</p>}
        <TextField
          label={t("auth.name.label")}
          autoComplete="name"
          value={name}
          error={errors.name}
          onChange={(event) => setName(event.target.value)}
        />
        <TextField
          label={t("auth.email.label")}
          type="email"
          autoComplete="username"
          value={email}
          error={errors.email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <TextField
          label={t("auth.password.label")}
          type="password"
          autoComplete="new-password"
          value={password}
          error={errors.password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <TextField
          label={t("auth.inviteCode.label")}
          value={inviteCode}
          error={errors.inviteCode}
          onChange={(event) => setInviteCode(event.target.value)}
        />
        <Button type="submit" disabled={busy}>{t("auth.signup.submit")}</Button>
        {busy && <Loader size="sm" />}
      </form>
      <Link className={styles.link} to="/login">{t("auth.login.link")}</Link>
    </CenteredPanel>
  );
}
