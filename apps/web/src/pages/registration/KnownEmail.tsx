import { useId } from "react";
import { t } from "@/shared/config/index.js";
import { LABEL_CLASS } from "@/shared/ui/index.js";

export function KnownEmail({ email }: { email: string }) {
  const labelId = useId();
  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-2">
      <span id={labelId} className={LABEL_CLASS}>{t("auth.email.label")}</span>
      <input type="email" hidden readOnly autoComplete="username" value={email} />
      <p className="text-sm font-medium">{email}</p>
      <p className="text-xs text-muted-foreground">{t("registration.email.fixed")}</p>
    </div>
  );
}
