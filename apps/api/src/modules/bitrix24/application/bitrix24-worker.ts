import { randomUUID } from "node:crypto";
import { Bitrix24Error } from "../domain/bitrix24-error.js";
import { SYNC_KINDS, type SyncKind } from "../domain/records.js";
import type { Bitrix24ApiFactory, ConnectionRepository, Secrets, StoredConnection, SyncStore } from "./ports.js";
import type { SyncContext, SyncEngine } from "./sync-engine.js";

const LEASE_MS = 5 * 60_000;
const INBOX_BATCH = 50;
const CHANGE_BATCH = 25;
const RUN_BATCH = 20;
const RUN_KINDS: ReadonlyArray<readonly [SyncKind, string]> = [["COMPANY", "company"], ["PERSON", "contact"], ["LEAD", "lead"]];

const itemFailure = (error: unknown): error is Bitrix24Error =>
  error instanceof Bitrix24Error && (error.kind === "REFUSED" || error.kind === "NOT_FOUND");

export function createBitrix24Worker(d: {
  connections: ConnectionRepository;
  store: SyncStore;
  engine: SyncEngine;
  apis: Bitrix24ApiFactory;
  secrets: Secrets;
  clock: { now(): Date };
  intervalMs?: number;
}) {
  let polling: ReturnType<typeof setInterval> | undefined;
  let active: Promise<void> | undefined;
  let stopped = false;

  const contextFor = async (connection: StoredConnection): Promise<SyncContext> => {
    const links = await d.connections.stageLinks(connection.id);
    return {
      connection,
      api: d.apis.open(d.secrets.unseal(connection.sealedWebhook, connection.orgId)),
      stageToStatus: new Map(links.map((link) => [link.stageKey, link.statusId])),
      statusToStage: new Map(links.map((link) => [link.statusId, link.stageKey])),
      ignoreAge: false,
      users: new Map(),
    };
  };

  const drainInbox = async (ctx: SyncContext) => {
    for (const item of await d.store.inbox(ctx.connection.id, INBOX_BATCH)) {
      try {
        await d.engine.pull(ctx, item.kind, item.remoteId);
      } catch (error) {
        if (!itemFailure(error)) throw error;
        await d.store.fail(ctx.connection.id, item.kind, `remote:${item.remoteId}`, `REFUSED: ${error.message}`, null);
      }
      await d.store.removeInbox(item.id);
    }
  };

  const pushChanges = async (ctx: SyncContext) => {
    for (const kind of SYNC_KINDS) {
      const changes = await d.store.changed(ctx.connection, kind, { limit: CHANGE_BATCH, unlinkedOnly: false, includeOld: false });
      for (const change of changes) {
        try {
          await d.engine.push(ctx, kind, change.id);
        } catch (error) {
          if (!itemFailure(error)) throw error;
          await d.store.fail(ctx.connection.id, kind, change.id, `REFUSED: ${error.message}`, change.watermark);
        }
      }
    }
  };

  const upload = async (ctx: SyncContext, runId: string) => {
    let created = 0;
    let failed = 0;
    let found = false;
    for (const [kind] of RUN_KINDS) {
      const changes = await d.store.changed(ctx.connection, kind, { limit: RUN_BATCH, unlinkedOnly: true, includeOld: true });
      for (const change of changes) {
        found = true;
        try {
          await d.engine.push(ctx, kind, change.id);
          created += 1;
        } catch (error) {
          if (!itemFailure(error)) throw error;
          await d.store.fail(ctx.connection.id, kind, change.id, `REFUSED: ${error.message}`, change.watermark);
          failed += 1;
        }
      }
    }
    await d.store.advanceRun(runId, found ? { created, failed } : { state: "DONE" });
  };

  const download = async (ctx: SyncContext, runId: string, cursor: Record<string, unknown>) => {
    const index = typeof cursor.kind === "number" ? cursor.kind : 0;
    const start = typeof cursor.start === "number" ? cursor.start : 0;
    const entry = RUN_KINDS[index];
    if (!entry) {
      await d.store.advanceRun(runId, { state: "DONE" });
      return;
    }
    const [kind, entity] = entry;
    const page = await ctx.api.list<{ ID?: unknown }>(`crm.${entity}.list`, { select: ["ID"], order: { ID: "ASC" }, start });
    const all = { ...ctx, ignoreAge: true };
    let created = 0;
    let failed = 0;
    for (const item of page.items) {
      try {
        if ((await d.engine.pull(all, kind, String(item.ID))) === "created") created += 1;
      } catch (error) {
        if (!itemFailure(error)) throw error;
        failed += 1;
      }
    }
    const next = page.next === null ? { kind: index + 1, start: 0 } : { kind: index, start: page.next };
    await d.store.advanceRun(runId, { created, failed, cursor: next });
  };

  const runStep = async (ctx: SyncContext) => {
    const run = await d.store.runningRun(ctx.connection.id);
    if (!run) return;
    if (run.direction === "UPLOAD") await upload(ctx, run.id);
    else await download(ctx, run.id, run.cursor);
  };

  const sync = async (connection: StoredConnection) => {
    try {
      const ctx = await contextFor(connection);
      await drainInbox(ctx);
      await pushChanges(ctx);
      await runStep(ctx);
      await d.connections.update(connection.id, { lastSyncAt: d.clock.now(), lastError: null });
    } catch (error) {
      if (error instanceof Bitrix24Error && error.kind === "AUTH") {
        await d.connections.update(connection.id, { status: "AUTH_REQUIRED", lastError: "AUTH" });
      } else if (error instanceof Bitrix24Error) {
        await d.connections.update(connection.id, { lastError: error.kind });
      } else {
        console.error("Bitrix24 sync failed:", error instanceof Error ? error.message : error);
        await d.connections.update(connection.id, { lastError: "INTERNAL" });
      }
    }
  };

  const tick = async () => {
    const owner = randomUUID();
    const seen: string[] = [];
    while (!stopped) {
      const connection = await d.connections.claim(d.clock.now(), owner, LEASE_MS, seen);
      if (!connection) return;
      seen.push(connection.id);
      try {
        await sync(connection);
      } finally {
        await d.connections.release(connection.id, owner);
      }
    }
  };

  return {
    tick,
    start() {
      if (polling) return;
      stopped = false;
      const run = () => {
        if (stopped || active) return;
        active = tick()
          .catch((error: unknown) => {
            console.error("Bitrix24 worker failed; pending work will be retried:", error instanceof Error ? error.message : error);
          })
          .finally(() => {
            active = undefined;
          });
      };
      polling = setInterval(run, d.intervalMs ?? 15_000);
      run();
    },
    async stop() {
      stopped = true;
      clearInterval(polling);
      polling = undefined;
      await active;
    },
  };
}

export type Bitrix24Worker = ReturnType<typeof createBitrix24Worker>;
