import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { CheckIcon, RefreshCwIcon } from "lucide-react";
import { ApiError, formatDateTime, http, navigation } from "@/shared/lib/index.js";
import { t } from "@/shared/config/index.js";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ProviderLogo,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/index.js";

export interface GoogleConnection {
  id: string;
  accountId: string;
  status: "QUEUED" | "RUNNING" | "SUCCESS" | "ERROR" | "AUTH_REQUIRED";
  lastSuccessAt: string | null;
  lastError: string | null;
}

interface GoogleAccount {
  accountId: string;
  name: string;
  currency: string;
  timezone: string;
  loginCustomerId: string | null;
}

interface GoogleAccounts {
  renewing: boolean;
  accounts: GoogleAccount[];
}

const integrationsPath = (projectId: string) => `/projects/${projectId}/integrations`;
const integrationsKey = (projectId: string) => ["integrations", projectId];

const failureText = (code: unknown) => {
  switch (code) {
    case "TOKEN":
      return t("google.error.token");
    case "ACCESS":
      return t("google.error.access");
    case "CURRENCY":
      return t("meta.error.currency");
    case "CONFIGURATION":
      return t("google.error.configuration");
    case "CONFLICT":
      return t("meta.error.conflict");
    default:
      return t("google.error.provider");
  }
};

export const googleFailureOf = (error: unknown) => {
  if (error instanceof ApiError && error.status === 409) return t("meta.error.duplicate");
  const code = error instanceof ApiError
    ? (error.details[0] as { code?: string } | undefined)?.code
    : undefined;
  return failureText(code);
};

export async function startGoogleSignIn(projectId: string, integrationId?: string): Promise<void> {
  const { url } = await http.post<{ url: string }>(
    `${integrationsPath(projectId)}/google/authorize`,
    integrationId ? { integrationId } : {},
  );
  navigation.go(url);
}

export function GoogleConnectionCard({
  projectId,
  connection,
}: {
  projectId: string;
  connection: GoogleConnection;
}) {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState(false);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const busy = connection.status === "QUEUED" || connection.status === "RUNNING";

  const refresh = async () => {
    setPending(true);
    setFailure(null);
    try {
      const saved = await http.post<GoogleConnection>(`${integrationsPath(projectId)}/${connection.id}/sync`, {});
      queryClient.setQueryData<GoogleConnection[]>(integrationsKey(projectId), (list) =>
        list?.map((item) => (item.id === saved.id ? saved : item)));
    } catch (error) {
      setFailure(googleFailureOf(error));
    } finally {
      setPending(false);
    }
  };

  return (
    <section
      className="flex w-min flex-col justify-between gap-2 rounded-lg border border-border glass-card p-3"
      aria-label={t("google.title")}
    >
      <div className="grid gap-1">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <ProviderLogo provider="GOOGLE" className="size-3 shrink-0" />
          {t("google.title")}
        </h2>
        {connection.lastSuccessAt && (
          <p className="text-xs text-muted-foreground">
            {t("meta.lastSuccess")} {formatDateTime(connection.lastSuccessAt)}
          </p>
        )}
        {connection.lastError && (
          <p role="alert" className="text-xs text-destructive">{failureText(connection.lastError)}</p>
        )}
        {failure && <p role="alert" className="text-xs text-destructive">{failure}</p>}
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={pending || busy}
          aria-busy={pending || busy}
          onClick={() => void refresh()}
        >
          <RefreshCwIcon className={pending || busy ? "animate-spin" : undefined} />
          {t("meta.refresh")}
        </Button>
        <Button variant="outline" size="sm" disabled={pending} onClick={() => setSettings(true)}>
          <CheckIcon className="text-emerald-500" />
          {t("google.api")}
        </Button>
      </div>
      {settings && (
        <GoogleSettingsDialog projectId={projectId} connection={connection} onClose={() => setSettings(false)} />
      )}
    </section>
  );
}

function GoogleSettingsDialog({
  projectId,
  connection,
  onClose,
}: {
  projectId: string;
  connection: GoogleConnection;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const signInAgain = async () => {
    setPending(true);
    setFailure(null);
    try {
      await startGoogleSignIn(projectId, connection.id);
    } catch (error) {
      setFailure(googleFailureOf(error));
      setPending(false);
    }
  };
  const disconnect = async () => {
    setPending(true);
    setFailure(null);
    try {
      await http.del(`${integrationsPath(projectId)}/${connection.id}`);
      queryClient.setQueryData<GoogleConnection[]>(integrationsKey(projectId), (list) =>
        list?.filter((item) => item.id !== connection.id));
      onClose();
    } catch (error) {
      setFailure(googleFailureOf(error));
      setPending(false);
    }
  };

  return (
    <Dialog open onOpenChange={(value) => { if (!value) onClose(); }}>
      <DialogContent className="h-auto">
        <DialogHeader>
          <DialogTitle>{t("google.settings")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <p className="text-sm">
            {t("google.account")}: <span className="font-medium">{connection.accountId}</span>
          </p>
          <p className="text-xs text-muted-foreground">{t("google.help")}</p>
          {failure && <p role="alert" className="text-xs text-destructive">{failure}</p>}
          <DialogFooter className="flex-wrap gap-2">
            <Button type="button" variant="ghost" disabled={pending} onClick={() => void disconnect()}>
              {t("meta.disconnect")}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("action.cancel")}
            </Button>
            <Button type="button" disabled={pending} onClick={() => void signInAgain()}>
              {t("google.signInAgain")}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function GoogleReturn({ projectId }: { projectId: string }) {
  const [params, setParams] = useSearchParams();
  const returned = params.get("google");
  const [authorization, setAuthorization] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (returned === null) return;
    if (returned === "failed") setFailed(true);
    else setAuthorization(returned);
    setParams((current) => {
      current.delete("google");
      return current;
    }, { replace: true });
  }, [returned, setParams]);

  return (
    <>
      {failed && (
        <section className="flex items-center gap-2 rounded-lg border border-border glass-card p-3">
          <p role="alert" className="text-xs text-destructive">{t("google.error.signIn")}</p>
          <Button variant="outline" size="sm" onClick={() => setFailed(false)}>
            {t("action.close")}
          </Button>
        </section>
      )}
      {authorization && (
        <GoogleAccountDialog
          projectId={projectId}
          authorization={authorization}
          onClose={() => setAuthorization(null)}
        />
      )}
    </>
  );
}

function GoogleAccountDialog({
  projectId,
  authorization,
  onClose,
}: {
  projectId: string;
  authorization: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const accounts = useQuery({
    queryKey: ["google-accounts", projectId, authorization],
    queryFn: () => http.get<GoogleAccounts>(
      `${integrationsPath(projectId)}/google/accounts?authorization=${authorization}`,
    ),
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
  });
  const [chosen, setChosen] = useState<string>("");
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const renewing = useRef(false);

  const connect = async (account?: GoogleAccount) => {
    setPending(true);
    setFailure(null);
    try {
      await http.post<GoogleConnection>(`${integrationsPath(projectId)}/google`, {
        authorization,
        ...(account ? { accountId: account.accountId, loginCustomerId: account.loginCustomerId } : {}),
      });
      await queryClient.invalidateQueries({ queryKey: integrationsKey(projectId) });
      onClose();
    } catch (error) {
      setFailure(googleFailureOf(error));
      setPending(false);
    }
  };

  useEffect(() => {
    if (!accounts.data?.renewing || renewing.current) return;
    renewing.current = true;
    void connect();
  });

  const list = accounts.data?.accounts ?? [];
  const picked = list.find((account) => account.accountId === chosen);
  const loadFailure = accounts.isError ? googleFailureOf(accounts.error) : null;

  return (
    <Dialog open onOpenChange={(value) => { if (!value && !pending) onClose(); }}>
      <DialogContent className="h-auto">
        <DialogHeader>
          <DialogTitle>{t("google.choose")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          {accounts.isPending || accounts.data?.renewing ? (
            <p className="text-sm text-muted-foreground">{t("google.loading")}</p>
          ) : loadFailure ? (
            <p role="alert" className="text-xs text-destructive">{loadFailure}</p>
          ) : list.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("google.empty")}</p>
          ) : (
            <Select value={chosen} onValueChange={setChosen} disabled={pending}>
              <SelectTrigger aria-label={t("google.account")} className="w-full">
                <SelectValue placeholder={t("google.account")} />
              </SelectTrigger>
              <SelectContent>
                {list.map((account) => (
                  <SelectItem key={account.accountId} value={account.accountId}>
                    {`${account.name} · ${account.accountId} · ${account.currency}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <p className="text-xs text-muted-foreground">{t("google.help")}</p>
          {failure && <p role="alert" className="text-xs text-destructive">{failure}</p>}
          <DialogFooter className="flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={pending} onClick={onClose}>
              {t("action.cancel")}
            </Button>
            <Button type="button" disabled={pending || !picked} onClick={() => void connect(picked)}>
              {pending ? t("meta.saving") : t("meta.connect")}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
