import { useState, type FormEvent } from "react";
import { t } from "@/shared/config/index.js";
import { ApiError } from "@/shared/lib/index.js";
import { Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, TextField, useAlerts } from "@/shared/ui/index.js";
import { usePlatformTwoFactorReset } from "../api/api.js";

export function PlatformTwoFactorReset() {
  const reset = usePlatformTwoFactorReset();
  const { raise } = useAlerts();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await reset.mutateAsync(email.trim());
      raise(t("twoFactor.reset.done"), "success");
      setOpen(false);
      setEmail("");
    } catch (failure) {
      setError(failure instanceof ApiError && failure.status === 404 ? t("twoFactor.platform.notFound") : t("twoFactor.failed"));
    }
  };

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>{t("twoFactor.platform.open")}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[min(480px,calc(100vw-2rem))] max-w-none">
          <DialogHeader>
            <DialogTitle>{t("twoFactor.platform.title")}</DialogTitle>
            <DialogDescription>{t("twoFactor.platform.hint")}</DialogDescription>
          </DialogHeader>
          <form className="flex flex-col gap-3" onSubmit={(event) => void submit(event)} noValidate>
            <TextField label={t("auth.email.label")} type="email" value={email} error={error ?? undefined} onChange={(event) => setEmail(event.target.value)} />
            <div className="flex justify-end">
              <Button type="submit" variant="destructive" disabled={reset.isPending || !email.trim()}>{t("twoFactor.reset.confirm")}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
