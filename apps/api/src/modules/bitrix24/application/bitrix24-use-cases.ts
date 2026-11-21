import { can, type Action } from "@adpulse/access-policy";
import { AppError } from "#shared/domain/index.js";
import type { ActorContext } from "#shared/application/index.js";
import { Bitrix24Error } from "../domain/bitrix24-error.js";
import { parseWebhookEvent } from "../domain/event.js";
import { parseWebhookAddress, type WebhookAddress } from "../domain/webhook-address.js";
import type { Bitrix24ApiFactory, ConnectionRepository, RunDirection, Secrets, StoredConnection } from "./ports.js";

export interface ConnectInput {
  webhookUrl: string;
  applicationToken: string;
}

export interface ConnectionChangeInput {
  webhookUrl?: string;
  applicationToken?: string;
  enabled?: boolean;
  inboundProjectId?: string | null;
}

export interface StageMappingInput {
  stageKey: string;
  statusId: string | null;
}

export const WEBHOOK_REFUSED = "Unknown Bitrix24 webhook";

export function createBitrix24UseCases(d: {
  connections: ConnectionRepository;
  secrets: Secrets;
  apis: Bitrix24ApiFactory;
  clock: { now(): Date };
  appUrl: string | null;
  isPublicHost: (host: string) => Promise<boolean>;
}) {
  const allow = (actor: ActorContext, action: Action) => {
    if (!can(actor, action, "bitrix24-connection")) throw new AppError("forbidden", "Only an admin may manage the Bitrix24 connection");
  };

  const current = async (actor: ActorContext) => {
    const connection = await d.connections.findByOrg(actor.orgId);
    if (!connection) throw new AppError("not-found", "Bitrix24 is not connected");
    return connection;
  };

  const view = (connection: StoredConnection) => ({
    portalHost: connection.portalHost,
    status: connection.status,
    enabled: connection.enabled,
    inboundProjectId: connection.inboundProjectId,
    connectedAt: connection.connectedAt,
    lastSyncAt: connection.lastSyncAt,
    lastError: connection.lastError,
    webhookUrl: `${d.appUrl ?? ""}/api/integrations/bitrix24/${connection.webhookKey}`,
  });

  const verify = async (raw: string): Promise<WebhookAddress> => {
    const address = parseWebhookAddress(raw);
    if (!address) throw new AppError("validation", "The webhook address must be an https Bitrix24 REST address");
    if (!(await d.isPublicHost(address.host))) throw new AppError("validation", "The webhook address must point at a public host");
    try {
      await d.apis.open(address.base).call("profile");
    } catch (error) {
      if (error instanceof Bitrix24Error && error.kind !== "TRANSIENT" && error.kind !== "RATE") {
        throw new AppError("validation", "Bitrix24 rejected the webhook address");
      }
      throw new AppError("unavailable", "Bitrix24 did not answer");
    }
    return address;
  };

  const token = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) throw new AppError("validation", "The application token is required");
    return trimmed;
  };

  const portal = async (connection: StoredConnection) => {
    const api = d.apis.open(d.secrets.unseal(connection.sealedWebhook, connection.orgId));
    return api;
  };

  return {
    async read(actor: ActorContext) {
      allow(actor, "read");
      const connection = await d.connections.findByOrg(actor.orgId);
      return connection ? view(connection) : null;
    },

    async connect(actor: ActorContext, input: ConnectInput) {
      allow(actor, "create");
      if (await d.connections.findByOrg(actor.orgId)) throw new AppError("conflict", "Bitrix24 is already connected");
      const applicationToken = token(input.applicationToken);
      const address = await verify(input.webhookUrl);
      const created = await d.connections.create({
        orgId: actor.orgId,
        portalHost: address.host,
        sealedWebhook: d.secrets.seal(address.base, actor.orgId),
        tokenHash: d.secrets.hash(applicationToken),
        webhookKey: d.secrets.newKey(),
        connectedAt: d.clock.now(),
      });
      return view(created);
    },

    async change(actor: ActorContext, input: ConnectionChangeInput) {
      allow(actor, "update");
      const connection = await current(actor);
      if (input.inboundProjectId && !(await d.connections.projectInOrganization(actor.orgId, input.inboundProjectId))) {
        throw new AppError("validation", "The inbound project must belong to the organization");
      }
      const address = input.webhookUrl !== undefined ? await verify(input.webhookUrl) : null;
      const updated = await d.connections.update(connection.id, {
        ...(address ? { portalHost: address.host, sealedWebhook: d.secrets.seal(address.base, actor.orgId), status: "ACTIVE" as const, lastError: null } : {}),
        ...(input.applicationToken !== undefined ? { tokenHash: d.secrets.hash(token(input.applicationToken)) } : {}),
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
        ...(input.inboundProjectId !== undefined ? { inboundProjectId: input.inboundProjectId } : {}),
      });
      if (input.inboundProjectId && input.inboundProjectId !== connection.inboundProjectId) {
        await d.connections.requeueSkipped(connection.id);
      }
      return view(updated);
    },

    async remove(actor: ActorContext) {
      allow(actor, "delete");
      const connection = await current(actor);
      await d.connections.remove(connection.id);
    },

    async statuses(actor: ActorContext) {
      allow(actor, "read");
      const connection = await current(actor);
      try {
        const rows = await (await portal(connection)).call<unknown>("crm.status.list", { filter: { ENTITY_ID: "STATUS" }, order: { SORT: "ASC" } });
        return (Array.isArray(rows) ? rows : [])
          .filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null)
          .map((row) => ({ id: String(row.STATUS_ID), name: String(row.NAME ?? row.STATUS_ID) }));
      } catch (error) {
        if (error instanceof Bitrix24Error && error.kind === "AUTH") {
          await d.connections.update(connection.id, { status: "AUTH_REQUIRED", lastError: "AUTH" });
        }
        throw new AppError("unavailable", "Bitrix24 did not answer");
      }
    },

    async stages(actor: ActorContext) {
      allow(actor, "read");
      const connection = await current(actor);
      const [options, links] = await Promise.all([d.connections.stageOptions(actor.orgId), d.connections.stageLinks(connection.id)]);
      const statusOf = new Map(links.map((link) => [link.stageKey, link.statusId]));
      return options.map((option) => ({ ...option, statusId: statusOf.get(option.key) ?? null }));
    },

    async setStages(actor: ActorContext, mapping: readonly StageMappingInput[]) {
      allow(actor, "update");
      const connection = await current(actor);
      const known = new Set((await d.connections.stageOptions(actor.orgId)).map((option) => option.key));
      const links = mapping.filter((entry): entry is { stageKey: string; statusId: string } => entry.statusId !== null);
      if (mapping.some((entry) => !known.has(entry.stageKey))) throw new AppError("validation", "Unknown stage");
      if (new Set(links.map((link) => link.statusId)).size !== links.length) {
        throw new AppError("validation", "A Bitrix24 status may be mapped to one stage only");
      }
      await d.connections.setStageLinks(connection.id, links);
    },

    async problems(actor: ActorContext) {
      allow(actor, "read");
      return d.connections.problems((await current(actor)).id);
    },

    async startRun(actor: ActorContext, direction: RunDirection) {
      allow(actor, "update");
      const run = await d.connections.startRun((await current(actor)).id, direction);
      if (!run) throw new AppError("conflict", "Another transfer is running");
      return run;
    },

    async latestRun(actor: ActorContext) {
      allow(actor, "read");
      return d.connections.latestRun((await current(actor)).id);
    },

    async receive(key: string, body: unknown): Promise<void> {
      const connection = await d.connections.findByKey(key);
      const event = parseWebhookEvent(body);
      if (!connection || !event.token || !d.secrets.matches(event.token, connection.tokenHash)) {
        throw new AppError("not-found", WEBHOOK_REFUSED);
      }
      if (!connection.enabled || !event.kind || !event.remoteId) return;
      await d.connections.enqueue(connection.id, event.kind, event.remoteId);
    },
  };
}

export type Bitrix24UseCases = ReturnType<typeof createBitrix24UseCases>;
