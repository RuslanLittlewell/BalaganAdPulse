import { useId, useState, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import {
  useClientAccount,
  useCreateClientAccount,
  useReissueClientPassword,
} from "@/entities/client/index.js";
import { t } from "@/shared/config/index.js";
import { Button, ConfirmDialog, CopyButton, Loader, useAlerts } from "@/shared/ui/index.js";

const HIDDEN_PASSWORD = "••••••••••••";

function Credential({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[200px_minmax(0,1fr)] sm:items-center sm:gap-4">
      <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 items-center gap-1 text-sm">{children}</dd>
    </div>
  );
}

export function CabinetAccess({ clientId }: { clientId: string }) {
  const titleId = useId();
  const account = useClientAccount(clientId);
  const create = useCreateClientAccount(clientId);
  const reissue = useReissueClientPassword(clientId);
  const [shown, setShown] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const { raise } = useAlerts();
  const credentials = account.data;

  function createAccess() {
    create.mutate(undefined, { onError: () => raise(t("contacts.cabinet.createFailed")) });
  }

  function issuePassword() {
    reissue.mutate(undefined, {
      onError: () => raise(t("contacts.cabinet.reissueFailed")),
      onSettled: () => setConfirming(false),
    });
  }

  return (
    <section aria-labelledby={titleId} className="mt-2 border-t border-border pt-4">
      <h4 id={titleId} className="text-sm font-semibold text-foreground">{t("contacts.cabinet.title")}</h4>

      {account.isPending && (
        <div className="grid place-items-center py-6">
          <Loader />
        </div>
      )}

      {account.isError && (
        <p className="py-3 text-sm text-muted-foreground">{t("contacts.cabinet.failed")}</p>
      )}

      {credentials === null && (
        <div className="flex flex-wrap items-center justify-between gap-3 py-3">
          <p className="text-sm text-muted-foreground">{t("contacts.cabinet.none")}</p>
          <Button size="sm" disabled={create.isPending} onClick={createAccess}>
            {t("contacts.cabinet.create")}
          </Button>
        </div>
      )}

      {credentials && (
        <>
          <dl className="divide-y divide-border">
            <Credential label={t("contacts.cabinet.login")}>
              <span className="min-w-0 break-all font-mono">{credentials.login}</span>
              <CopyButton value={credentials.login} label={t("contacts.cabinet.copyLogin")} />
            </Credential>
            <Credential label={t("contacts.cabinet.password")}>
              {credentials.password ? (
                <>
                  <span className="min-w-0 truncate font-mono" data-testid="cabinet-password">
                    {shown ? credentials.password : HIDDEN_PASSWORD}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={shown ? t("contacts.cabinet.hide") : t("contacts.cabinet.show")}
                    aria-pressed={shown}
                    onClick={() => setShown((value) => !value)}
                  >
                    {shown ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                  </Button>
                  <CopyButton value={credentials.password} label={t("contacts.cabinet.copyPassword")} />
                </>
              ) : (
                <span className="text-muted-foreground">{t("contacts.cabinet.changed")}</span>
              )}
            </Credential>
          </dl>
          <div className="flex justify-end pt-2">
            <Button size="sm" variant="outline" onClick={() => setConfirming(true)}>
              {t("contacts.cabinet.newPassword")}
            </Button>
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirming}
        title={t("contacts.cabinet.newPassword.title")}
        description={t("contacts.cabinet.newPassword.body")}
        confirmLabel={t("contacts.cabinet.newPassword.confirm")}
        pending={reissue.isPending}
        onConfirm={issuePassword}
        onClose={() => setConfirming(false)}
      />
    </section>
  );
}
