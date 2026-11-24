import { useEffect, useState, type FormEvent } from "react";
import { t } from "@/shared/config/index.js";
import { ApiError, formatDateTime } from "@/shared/lib/index.js";
import { Button, CopyButton, Label, Loader, SearchableSelect, TextField } from "@/shared/ui/index.js";
import { useLeadBoards } from "@/entities/lead/index.js";
import {
  useBitrix24Changes,
  useBitrix24Connection,
  useBitrix24Details,
  type Bitrix24Connection,
  type Bitrix24Problem,
  type Bitrix24Run,
} from "../api/api.js";

type Asking = "off" | "replace" | "remove" | "UPLOAD" | "DOWNLOAD";

const NONE = "none";
const PROBLEM_KINDS = ["LEAD", "PERSON", "COMPANY", "NOTE", "TASK", "COMMENT", "STATUS"] as const;
const NO_AUTOFILL = {
  autoComplete: "off",
  autoCorrect: "off",
  autoCapitalize: "none",
  spellCheck: false,
  "data-1p-ignore": "true",
  "data-lpignore": "true",
  "data-bwignore": "true",
  "data-form-type": "other",
} as const;

function failureText(error: unknown): string {
  if (error instanceof ApiError && error.status === 400) return t("bitrix.connect.refused");
  if (error instanceof ApiError && error.status === 503) return t("bitrix.unavailable");
  return t("bitrix.failed");
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </section>
  );
}

function CredentialsForm({ submitLabel, pending, onSubmit }: {
  submitLabel: string;
  pending: boolean;
  onSubmit: (values: { webhookUrl: string; applicationToken: string }) => void;
}) {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [applicationToken, setApplicationToken] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit({ webhookUrl: webhookUrl.trim(), applicationToken: applicationToken.trim() });
  };
  return (
    <form className="flex flex-col gap-3" autoComplete="off" onSubmit={submit}>
      <div className="flex flex-col gap-1">
        <TextField
          {...NO_AUTOFILL}
          label={t("bitrix.webhook")}
          name="bitrix24-rest-address"
          value={webhookUrl}
          placeholder="https://example.bitrix24.ru/rest/1/…/"
          onChange={(event) => setWebhookUrl(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">{t("bitrix.webhook.hint")}</p>
      </div>
      <div className="flex flex-col gap-1">
        <TextField
          {...NO_AUTOFILL}
          label={t("bitrix.token")}
          name="bitrix24-application-token"
          value={applicationToken}
          onChange={(event) => setApplicationToken(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">{t("bitrix.token.hint")}</p>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending || !webhookUrl.trim() || !applicationToken.trim()}>{submitLabel}</Button>
      </div>
    </form>
  );
}

function stateText(connection: Bitrix24Connection): string {
  if (connection.status === "AUTH_REQUIRED") return t("bitrix.state.auth");
  return connection.enabled ? t("bitrix.state.active") : t("bitrix.state.off");
}

function problemText(problem: Bitrix24Problem): string {
  const kind = (PROBLEM_KINDS as readonly string[]).includes(problem.kind)
    ? t(`bitrix.kind.${problem.kind as (typeof PROBLEM_KINDS)[number]}`)
    : problem.kind;
  const subject = problem.label
    ?? (problem.key.startsWith("remote:") ? `${t("bitrix.problem.remote")}${problem.key.slice(7)}` : problem.key);
  const reason = problem.reason === "NO_INBOUND_PROJECT"
    ? t("bitrix.problem.NO_INBOUND_PROJECT")
    : problem.reason === "UNMAPPED_STATUS"
      ? t("bitrix.problem.UNMAPPED_STATUS")
      : `${t("bitrix.problem.REFUSED")} ${problem.reason.replace(/^REFUSED:\s*/, "")}`;
  return `${kind} «${subject}»: ${reason}`;
}

function runText(run: Bitrix24Run): string {
  const head = run.state === "RUNNING" ? t("bitrix.runs.running") : t("bitrix.runs.done");
  return `${head} ${run.created}, ${t("bitrix.runs.linkedCount")} ${run.linked}, ${t("bitrix.runs.failedCount")} ${run.failed}`;
}

function StageMapping({ connected }: { connected: boolean }) {
  const { statuses, stages } = useBitrix24Details(connected);
  const { saveStages } = useBitrix24Changes();
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (stages.data) setChosen(Object.fromEntries(stages.data.map((stage) => [stage.key, stage.statusId ?? ""])));
  }, [stages.data]);

  if (stages.isPending) return <Loader label={t("state.loading")} />;
  const save = async () => {
    setFailed(false);
    try {
      await saveStages.mutateAsync(Object.entries(chosen).map(([stageKey, statusId]) => ({ stageKey, statusId: statusId || null })));
    } catch {
      setFailed(true);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {statuses.isError ? <p role="alert" className="text-sm text-destructive">{t("bitrix.stages.statusesFailed")}</p> : null}
      {(stages.data ?? []).map((stage) => {
        const id = `bitrix-stage-${stage.key}`;
        const label = stage.projectName ? `${stage.name} · ${stage.projectName}` : stage.name;
        return (
          <div key={stage.key} className="flex items-center gap-3">
            <Label htmlFor={id} className="w-2/5 min-w-0 truncate text-sm font-normal">{label}</Label>
            <SearchableSelect
              id={id}
              className="min-w-0 flex-1"
              value={chosen[stage.key] || NONE}
              pinned={[{ value: NONE, label: t("bitrix.stages.none") }]}
              options={(statuses.data ?? []).map((status) => ({ value: status.id, label: status.name }))}
              searchLabel={t("select.search")}
              emptyLabel={t("select.search.empty")}
              onValueChange={(next) => setChosen((current) => ({ ...current, [stage.key]: next === NONE ? "" : next }))}
            />
          </div>
        );
      })}
      {failed ? <p role="alert" className="text-sm text-destructive">{t("bitrix.failed")}</p> : null}
      <div className="flex justify-end">
        <Button type="button" variant="outline" disabled={saveStages.isPending} onClick={() => void save()}>{t("bitrix.stages.save")}</Button>
      </div>
    </div>
  );
}

function Connected({ connection }: { connection: Bitrix24Connection }) {
  const { problems, run } = useBitrix24Details(true);
  const changes = useBitrix24Changes();
  const { data: boards } = useLeadBoards();
  const [asking, setAsking] = useState<Asking | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const pending = changes.change.isPending || changes.remove.isPending || changes.startRun.isPending;

  const act = async (action: () => Promise<unknown>) => {
    setFailure(null);
    try {
      await action();
      setAsking(null);
    } catch (error) {
      setFailure(error instanceof ApiError && error.status === 409 ? t("bitrix.failed") : failureText(error));
    }
  };

  const confirm = (choice: Asking) => act(() => {
    if (choice === "off") return changes.change.mutateAsync({ enabled: false });
    if (choice === "remove") return changes.remove.mutateAsync();
    return changes.startRun.mutateAsync(choice === "UPLOAD" ? "UPLOAD" : "DOWNLOAD");
  });

  const warning: Record<Exclude<Asking, "replace">, { text: string; confirm: string }> = {
    off: { text: t("bitrix.off.warning"), confirm: t("bitrix.off.confirm") },
    remove: { text: t("bitrix.remove.warning"), confirm: t("bitrix.remove.confirm") },
    UPLOAD: { text: t("bitrix.runs.warning"), confirm: t("bitrix.runs.confirm") },
    DOWNLOAD: { text: t("bitrix.runs.warning"), confirm: t("bitrix.runs.confirm") },
  };
  const askingLabel: Record<Asking, string> = {
    off: t("bitrix.off"),
    replace: t("bitrix.replace"),
    remove: t("bitrix.remove"),
    UPLOAD: t("bitrix.runs.upload"),
    DOWNLOAD: t("bitrix.runs.download"),
  };

  return (
    <div className="flex flex-col gap-5">
      <Section title={t("bitrix.state")}>
        <p role="status" data-status={connection.status} data-enabled={connection.enabled} className="text-sm">
          {stateText(connection)} · {connection.portalHost}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("bitrix.state.lastSync")} {connection.lastSyncAt ? formatDateTime(connection.lastSyncAt) : t("bitrix.state.never")}
        </p>
        {connection.lastError && connection.status === "ACTIVE" ? <p className="text-xs text-muted-foreground">{t("bitrix.state.error")}</p> : null}
      </Section>

      <Section title={t("bitrix.handler")} hint={t("bitrix.handler.hint")}>
        <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-2">
          <code className="min-w-0 flex-1 break-all text-xs">{connection.webhookUrl}</code>
          <CopyButton value={connection.webhookUrl} label={t("bitrix.handler.copy")} />
        </div>
      </Section>

      <Section title={t("bitrix.stages")} hint={t("bitrix.stages.hint")}>
        <StageMapping connected />
      </Section>

      <Section title={t("bitrix.inbound")} hint={t("bitrix.inbound.hint")}>
        <SearchableSelect
          ariaLabel={t("bitrix.inbound")}
          value={connection.inboundProjectId ?? NONE}
          disabled={pending}
          pinned={[{ value: NONE, label: t("bitrix.inbound.none") }]}
          options={(boards ?? []).map((board) => ({ value: board.key, label: `${board.label} · ${board.clientName}` }))}
          searchLabel={t("select.search")}
          emptyLabel={t("select.search.empty")}
          onValueChange={(next) => void act(() => changes.change.mutateAsync({ inboundProjectId: next === NONE ? null : next }))}
        />
      </Section>

      <Section title={t("bitrix.problems")}>
        {problems.data && problems.data.length > 0 ? (
          <ul aria-label={t("bitrix.problems")} className="flex max-h-40 flex-col gap-1 overflow-y-auto text-sm">
            {problems.data.map((problem) => <li key={`${problem.kind}:${problem.key}`}>{problemText(problem)}</li>)}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t("bitrix.problems.empty")}</p>
        )}
      </Section>

      <Section title={t("bitrix.runs")} hint={t("bitrix.runs.hint")}>
        {run.data ? <p role="status" className="text-sm">{runText(run.data)}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={run.data?.state === "RUNNING"} onClick={() => setAsking("UPLOAD")}>{t("bitrix.runs.upload")}</Button>
          <Button type="button" variant="outline" disabled={run.data?.state === "RUNNING"} onClick={() => setAsking("DOWNLOAD")}>{t("bitrix.runs.download")}</Button>
        </div>
      </Section>

      {asking ? (
        <div role="group" aria-label={askingLabel[asking]} className="flex flex-col gap-2 rounded-md border border-destructive/40 p-3">
          {asking === "replace" ? (
            <>
              <p className="text-sm">{t("bitrix.replace.warning")}</p>
              <CredentialsForm
                submitLabel={t("bitrix.replace.confirm")}
                pending={pending}
                onSubmit={(values) => void act(() => changes.change.mutateAsync(values))}
              />
              <div className="flex justify-end">
                <Button type="button" variant="outline" onClick={() => setAsking(null)}>{t("action.cancel")}</Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm">{warning[asking].text}</p>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setAsking(null)}>{t("action.cancel")}</Button>
                <Button type="button" variant="destructive" disabled={pending} onClick={() => void confirm(asking)}>{warning[asking].confirm}</Button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap justify-end gap-2">
          {connection.enabled
            ? <Button type="button" variant="outline" onClick={() => setAsking("off")}>{t("bitrix.off")}</Button>
            : <Button type="button" variant="outline" disabled={pending} onClick={() => void act(() => changes.change.mutateAsync({ enabled: true }))}>{t("bitrix.on")}</Button>}
          <Button type="button" variant="outline" onClick={() => setAsking("replace")}>{t("bitrix.replace")}</Button>
          <Button type="button" variant="outline" onClick={() => setAsking("remove")}>{t("bitrix.remove")}</Button>
        </div>
      )}

      {failure ? <p role="alert" className="text-sm text-destructive">{failure}</p> : null}
    </div>
  );
}

export function Bitrix24Panel({ active = true }: { active?: boolean }) {
  const connection = useBitrix24Connection({ enabled: active });
  const { connect } = useBitrix24Changes();
  const [failure, setFailure] = useState<string | null>(null);

  if (connection.isPending) return <Loader label={t("state.loading")} />;
  if (connection.isError) return <p role="alert" className="text-sm text-destructive">{t("bitrix.loadFailed")}</p>;
  if (connection.data) return <Connected connection={connection.data} />;

  return (
    <div className="flex flex-col gap-4">
      <CredentialsForm
        submitLabel={t("bitrix.connect")}
        pending={connect.isPending}
        onSubmit={(values) => {
          setFailure(null);
          connect.mutateAsync(values).catch((error: unknown) => setFailure(failureText(error)));
        }}
      />
      {failure ? <p role="alert" className="text-sm text-destructive">{failure}</p> : null}
    </div>
  );
}
