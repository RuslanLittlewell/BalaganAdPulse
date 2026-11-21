import { Bitrix24Error } from "../domain/bitrix24-error.js";
import {
  REMOTE_AUTHOR_PREFIX,
  companyToRemote,
  contactToRemote,
  documentOf,
  leadToRemote,
  noteToComment,
  parseRemoteCompany,
  parseRemoteContact,
  parseRemoteLead,
  parseRemoteTask,
  plainTextOf,
  taskToRemote,
  type RemoteTask,
  type SyncKind,
} from "../domain/records.js";
import type {
  Bitrix24Api,
  CrmAnnouncer,
  LocalCompany,
  LocalLead,
  LocalPerson,
  RecordLink,
  StoredConnection,
  SyncStore,
} from "./ports.js";

type Raw = Record<string, unknown>;

export type PullOutcome = "created" | "updated" | "skipped";

export interface SyncContext {
  readonly connection: StoredConnection;
  readonly api: Bitrix24Api;
  readonly stageToStatus: ReadonlyMap<string, string>;
  readonly statusToStage: ReadonlyMap<string, string>;
  readonly ignoreAge: boolean;
  readonly users: Map<string, Raw | null>;
}

export const NO_INBOUND_PROJECT = "NO_INBOUND_PROJECT";
export const UNMAPPED_STATUS = "UNMAPPED_STATUS";
const NOTE_LIMIT = 5000;

const isNewer = (a: Date | null, b: Date | null) => a !== null && (b === null || a.getTime() > b.getTime());
const remoteKey = (id: string) => `remote:${id}`;
const missing = (error: unknown) => error instanceof Bitrix24Error && error.kind === "NOT_FOUND";

interface Modified {
  id: string;
  createdAt: Date | null;
  modifiedAt: Date | null;
}

interface RecordKind<L extends { id: string; updatedAt: Date; clientId: string }, R extends Modified> {
  kind: "LEAD" | "PERSON" | "COMPANY";
  entity: "lead" | "contact" | "company";
  load(id: string): Promise<L | null>;
  parse(raw: Raw): R;
  toRemote(ctx: SyncContext, local: L): Promise<Raw>;
  apply(ctx: SyncContext, local: L, remote: R): Promise<Date>;
  create(ctx: SyncContext, remote: R, clientId: string | null): Promise<{ id: string; updatedAt: Date } | null>;
}

export function createSyncEngine(d: { store: SyncStore; announce: CrmAnnouncer }) {
  const { store } = d;

  const fetchRaw = async (ctx: SyncContext, method: string, params: Raw): Promise<Raw | null> => {
    try {
      const result = await ctx.api.call<unknown>(method, params);
      return result && typeof result === "object" && !Array.isArray(result) ? result as Raw : null;
    } catch (error) {
      if (missing(error)) return null;
      throw error;
    }
  };

  const remoteOf = async (ctx: SyncContext, kind: SyncKind, localId: string | null): Promise<string | null> => {
    if (!localId) return null;
    const link = await store.link(ctx.connection.id, kind, localId);
    return link && !link.dropped ? link.remoteId : null;
  };

  const remoteUser = async (ctx: SyncContext, filter: Raw): Promise<Raw | null> => {
    const cacheKey = JSON.stringify(filter);
    if (ctx.users.has(cacheKey)) return ctx.users.get(cacheKey) ?? null;
    const users = await ctx.api.call<unknown>("user.get", { FILTER: filter });
    const found = Array.isArray(users) && users[0] && typeof users[0] === "object" ? users[0] as Raw : null;
    ctx.users.set(cacheKey, found);
    return found;
  };

  const remoteUserName = async (ctx: SyncContext, id: unknown): Promise<string | null> => {
    if (!id || String(id) === "0") return null;
    const user = await remoteUser(ctx, { ID: String(id) });
    const name = user ? [user.NAME, user.LAST_NAME].filter((part) => typeof part === "string" && part.trim()).join(" ") : "";
    return name || null;
  };

  const stageFor = async (ctx: SyncContext, statusId: string | null, projectId: string): Promise<string | undefined> => {
    if (!statusId) return undefined;
    const key = ctx.statusToStage.get(statusId);
    if (!key) {
      await store.fail(ctx.connection.id, "STATUS", statusId, UNMAPPED_STATUS, null);
      return undefined;
    }
    return (await store.stageInProject(key, projectId)) ? key : undefined;
  };

  const inboundClient = async (ctx: SyncContext) => {
    const projectId = ctx.connection.inboundProjectId;
    const clientId = projectId ? await store.projectClient(projectId) : null;
    return projectId && clientId ? { projectId, clientId } : null;
  };

  const tooOld = (ctx: SyncContext, remote: Modified) =>
    !ctx.ignoreAge && remote.createdAt !== null && remote.createdAt.getTime() < ctx.connection.connectedAt.getTime();

  const kinds = {} as {
    LEAD: RecordKind<LocalLead, ReturnType<typeof parseRemoteLead>>;
    PERSON: RecordKind<LocalPerson, ReturnType<typeof parseRemoteContact>>;
    COMPANY: RecordKind<LocalCompany, ReturnType<typeof parseRemoteCompany>>;
  };

  const getRecord = <L extends { id: string; updatedAt: Date; clientId: string }, R extends Modified>(
    ctx: SyncContext, k: RecordKind<L, R>, remoteId: string,
  ) => fetchRaw(ctx, `crm.${k.entity}.get`, { id: remoteId }).then((raw) => (raw ? k.parse(raw) : null));

  const saveRecordLink = (ctx: SyncContext, kind: SyncKind, localId: string, remoteId: string, remoteModifiedAt: Date | null, localSyncedAt: Date) =>
    store.saveLink(ctx.connection.id, { kind, localId, remoteId, remoteModifiedAt, localSyncedAt });

  async function applyRecord<L extends { id: string; updatedAt: Date; clientId: string }, R extends Modified>(
    ctx: SyncContext, k: RecordKind<L, R>, remote: R, link: RecordLink,
  ): Promise<boolean> {
    const local = await k.load(link.localId);
    if (!local) {
      await store.dropLink(link.id);
      return false;
    }
    if (!isNewer(remote.modifiedAt, link.remoteModifiedAt)) return false;
    const localChanged = local.updatedAt.getTime() > link.localSyncedAt.getTime();
    if (localChanged && !isNewer(remote.modifiedAt, local.updatedAt)) return false;
    const updatedAt = await k.apply(ctx, local, remote);
    await saveRecordLink(ctx, k.kind, local.id, remote.id, remote.modifiedAt, updatedAt);
    return true;
  }

  async function pushRecord<L extends { id: string; updatedAt: Date; clientId: string }, R extends Modified>(
    ctx: SyncContext, k: RecordKind<L, R>, id: string,
  ): Promise<void> {
    const local = await k.load(id);
    if (!local) return;
    const link = await store.link(ctx.connection.id, k.kind, id);
    if (link?.dropped) return;
    const fields = await k.toRemote(ctx, local);
    let remoteId: string;
    if (!link) {
      remoteId = String(await ctx.api.call(`crm.${k.entity}.add`, { fields }));
    } else {
      const remote = await getRecord(ctx, k, link.remoteId);
      if (!remote) {
        await store.dropLink(link.id);
        return;
      }
      if (isNewer(remote.modifiedAt, link.remoteModifiedAt) && isNewer(remote.modifiedAt, local.updatedAt)) {
        await applyRecord(ctx, k, remote, link);
        return;
      }
      try {
        await ctx.api.call(`crm.${k.entity}.update`, { id: link.remoteId, fields });
      } catch (error) {
        if (!missing(error)) throw error;
        await store.dropLink(link.id);
        return;
      }
      remoteId = link.remoteId;
    }
    const after = await getRecord(ctx, k, remoteId);
    await saveRecordLink(ctx, k.kind, local.id, remoteId, after?.modifiedAt ?? null, local.updatedAt);
    await store.clear(ctx.connection.id, k.kind, local.id);
  }

  async function pullRecord<L extends { id: string; updatedAt: Date; clientId: string }, R extends Modified>(
    ctx: SyncContext, k: RecordKind<L, R>, remoteId: string,
  ): Promise<PullOutcome> {
    const link = await store.linkByRemote(ctx.connection.id, k.kind, remoteId);
    if (link?.dropped) return "skipped";
    const remote = await getRecord(ctx, k, remoteId);
    if (!remote) {
      if (link) await store.dropLink(link.id);
      return "skipped";
    }
    if (link) return (await applyRecord(ctx, k, remote, link)) ? "updated" : "skipped";
    if (tooOld(ctx, remote)) return "skipped";
    const created = await k.create(ctx, remote, null);
    if (!created) return "skipped";
    await saveRecordLink(ctx, k.kind, created.id, remote.id, remote.modifiedAt, created.updatedAt);
    await store.clear(ctx.connection.id, k.kind, remoteKey(remote.id));
    return "created";
  }

  async function ensureRecord<L extends { id: string; updatedAt: Date; clientId: string }, R extends Modified>(
    ctx: SyncContext, k: RecordKind<L, R>, remoteId: string, clientId: string,
  ): Promise<string | null> {
    const link = await store.linkByRemote(ctx.connection.id, k.kind, remoteId);
    if (link?.dropped) return null;
    if (link) {
      const local = await k.load(link.localId);
      if (local) return local.clientId === clientId ? local.id : null;
      await store.dropLink(link.id);
      return null;
    }
    const remote = await getRecord(ctx, k, remoteId);
    if (!remote) return null;
    const created = await k.create(ctx, remote, clientId);
    if (!created) return null;
    await saveRecordLink(ctx, k.kind, created.id, remote.id, remote.modifiedAt, created.updatedAt);
    return created.id;
  }

  const skip = async (ctx: SyncContext, kind: SyncKind, remoteId: string) => {
    await store.fail(ctx.connection.id, kind, remoteKey(remoteId), NO_INBOUND_PROJECT, null);
    return null;
  };

  kinds.COMPANY = {
    kind: "COMPANY",
    entity: "company",
    load: (id) => store.company(id),
    parse: parseRemoteCompany,
    toRemote: async (_ctx, company) => companyToRemote(company),
    apply: (_ctx, local, remote) => store.updateCompany(local.id, { name: remote.title, phone: remote.phone, website: remote.website }),
    create: async (ctx, remote, clientId) => {
      const target = clientId ?? (await inboundClient(ctx))?.clientId ?? null;
      if (!target) return skip(ctx, "COMPANY", remote.id);
      return store.createCompany(ctx.connection.orgId, target, { name: remote.title, phone: remote.phone, website: remote.website });
    },
  };

  kinds.PERSON = {
    kind: "PERSON",
    entity: "contact",
    load: (id) => store.person(id),
    parse: parseRemoteContact,
    toRemote: async (ctx, person) => contactToRemote(person, await remoteOf(ctx, "COMPANY", person.companyId)),
    apply: async (ctx, local, remote) => store.updatePerson(local.id, {
      name: remote.name,
      phone: remote.phone,
      email: remote.email,
      companyId: remote.companyId ? await ensureRecord(ctx, kinds.COMPANY, remote.companyId, local.clientId) : null,
    }),
    create: async (ctx, remote, clientId) => {
      const target = clientId ?? (await inboundClient(ctx))?.clientId ?? null;
      if (!target) return skip(ctx, "PERSON", remote.id);
      const companyId = remote.companyId ? await ensureRecord(ctx, kinds.COMPANY, remote.companyId, target) : null;
      return store.createPerson(ctx.connection.orgId, target, { name: remote.name, phone: remote.phone, email: remote.email, companyId });
    },
  };

  kinds.LEAD = {
    kind: "LEAD",
    entity: "lead",
    load: (id) => store.lead(id),
    parse: parseRemoteLead,
    toRemote: async (ctx, lead) => leadToRemote(lead, {
      statusId: ctx.stageToStatus.get(lead.stageKey) ?? null,
      contactId: await remoteOf(ctx, "PERSON", lead.personId),
      companyId: await remoteOf(ctx, "COMPANY", lead.companyId),
    }),
    apply: async (ctx, local, remote) => {
      const stageKey = await stageFor(ctx, remote.statusId, local.projectId);
      const updatedAt = await store.updateLead(local.id, {
        name: remote.title,
        amount: remote.amount,
        source: remote.source,
        notes: remote.notes,
        personId: remote.contactId ? await ensureRecord(ctx, kinds.PERSON, remote.contactId, local.clientId) : null,
        companyId: remote.companyId ? await ensureRecord(ctx, kinds.COMPANY, remote.companyId, local.clientId) : null,
        ...(stageKey ? { stageKey } : {}),
      });
      d.announce.leadsChanged(ctx.connection.orgId, local.projectId);
      return updatedAt;
    },
    create: async (ctx, remote) => {
      const target = await inboundClient(ctx);
      if (!target) return skip(ctx, "LEAD", remote.id);
      const stageKey = (await stageFor(ctx, remote.statusId, target.projectId)) ?? "NEW";
      const created = await store.createLead(ctx.connection.orgId, target.projectId, {
        name: remote.title,
        amount: remote.amount,
        source: remote.source,
        notes: remote.notes,
        personId: remote.contactId ? await ensureRecord(ctx, kinds.PERSON, remote.contactId, target.clientId) : null,
        companyId: remote.companyId ? await ensureRecord(ctx, kinds.COMPANY, remote.companyId, target.clientId) : null,
        stageKey,
      });
      d.announce.leadsChanged(ctx.connection.orgId, target.projectId);
      return created;
    },
  };

  const announceLead = async (ctx: SyncContext, leadId: string) => {
    const lead = await store.lead(leadId);
    if (lead) d.announce.leadsChanged(ctx.connection.orgId, lead.projectId);
  };

  const stripAuthor = (text: string, author: string | null) =>
    author && text.startsWith(`${author}: `) ? text.slice(author.length + 2) : text;

  async function pushNote(ctx: SyncContext, id: string): Promise<void> {
    const note = await store.note(id);
    if (!note) return;
    const leadRemote = await remoteOf(ctx, "LEAD", note.leadId);
    const link = await store.link(ctx.connection.id, "NOTE", id);
    if (!leadRemote || link?.dropped) return;
    const fields = { ENTITY_ID: Number(leadRemote), ENTITY_TYPE: "lead", COMMENT: noteToComment(note.authorName, note.body) };
    let remoteId = link?.remoteId;
    if (!remoteId) {
      remoteId = String(await ctx.api.call("crm.timeline.comment.add", { fields }));
    } else {
      try {
        await ctx.api.call("crm.timeline.comment.update", { id: remoteId, fields });
      } catch (error) {
        if (!missing(error)) throw error;
        await store.dropLink(link!.id);
        return;
      }
    }
    await saveRecordLink(ctx, "NOTE", note.id, remoteId, null, note.watermark);
    await store.clear(ctx.connection.id, "NOTE", note.id);
  }

  async function pullNote(ctx: SyncContext, remoteId: string): Promise<PullOutcome> {
    const link = await store.linkByRemote(ctx.connection.id, "NOTE", remoteId);
    if (link?.dropped) return "skipped";
    const raw = await fetchRaw(ctx, "crm.timeline.comment.get", { id: remoteId });
    if (!raw) {
      if (link) await store.dropLink(link.id);
      return "skipped";
    }
    if (String(raw.ENTITY_TYPE ?? "").toLowerCase() !== "lead") return "skipped";
    const text = String(raw.COMMENT ?? "").trim();
    if (!text) return "skipped";
    if (link) {
      const local = await store.note(link.localId);
      if (!local) {
        await store.dropLink(link.id);
        return "skipped";
      }
      if (text === noteToComment(local.authorName, local.body)) return "skipped";
      const body = stripAuthor(text, local.authorName).slice(0, NOTE_LIMIT);
      if (body === local.body) return "skipped";
      const watermark = await store.updateNote(local.id, body);
      await saveRecordLink(ctx, "NOTE", local.id, remoteId, null, watermark);
      await announceLead(ctx, local.leadId);
      return "updated";
    }
    const leadLink = await store.linkByRemote(ctx.connection.id, "LEAD", String(raw.ENTITY_ID));
    if (!leadLink || leadLink.dropped) return "skipped";
    const author = await remoteUserName(ctx, raw.AUTHOR_ID);
    const body = (author ? `${author}: ${text}` : `${REMOTE_AUTHOR_PREFIX}${text}`).slice(0, NOTE_LIMIT);
    const created = await store.createNote(ctx.connection.orgId, leadLink.localId, body);
    await saveRecordLink(ctx, "NOTE", created.id, remoteId, null, created.watermark);
    await announceLead(ctx, leadLink.localId);
    return "created";
  }

  const TASK_SELECT = ["ID", "TITLE", "DESCRIPTION", "DEADLINE", "STATUS", "RESPONSIBLE_ID", "CHANGED_DATE", "UF_CRM_TASK"];

  const fetchTask = async (ctx: SyncContext, remoteId: string): Promise<RemoteTask | null> => {
    const result = await fetchRaw(ctx, "tasks.task.get", { taskId: remoteId, select: TASK_SELECT });
    const task = result?.task;
    return task && typeof task === "object" ? parseRemoteTask(task as Raw) : null;
  };

  const membershipFor = async (ctx: SyncContext, responsibleId: string | null): Promise<string | null> => {
    if (!responsibleId) return null;
    const user = await remoteUser(ctx, { ID: responsibleId });
    const email = typeof user?.EMAIL === "string" ? user.EMAIL : null;
    return email ? store.membershipByEmail(ctx.connection.orgId, email) : null;
  };

  const responsibleFor = async (ctx: SyncContext, email: string | null): Promise<string | null> => {
    if (!email) return null;
    const user = await remoteUser(ctx, { EMAIL: email });
    return user?.ID ? String(user.ID) : null;
  };

  async function applyTask(ctx: SyncContext, remote: RemoteTask, link: RecordLink): Promise<boolean> {
    const local = await store.task(link.localId);
    if (!local) {
      await store.dropLink(link.id);
      return false;
    }
    if (!isNewer(remote.modifiedAt, link.remoteModifiedAt)) return false;
    const localChanged = local.updatedAt.getTime() > link.localSyncedAt.getTime();
    if (localChanged && !isNewer(remote.modifiedAt, local.updatedAt)) return false;
    const updatedAt = await store.updateTask(local.id, {
      title: remote.title,
      dueDate: remote.deadline,
      done: remote.done,
      assigneeId: await membershipFor(ctx, remote.responsibleId),
      ...(local.description == null && remote.description ? { description: documentOf(remote.description) } : {}),
    });
    await saveRecordLink(ctx, "TASK", local.id, remote.id, remote.modifiedAt, updatedAt);
    return true;
  }

  async function pushTask(ctx: SyncContext, id: string): Promise<void> {
    const task = await store.task(id);
    if (!task) return;
    const leadRemote = await remoteOf(ctx, "LEAD", task.leadId);
    const link = await store.link(ctx.connection.id, "TASK", id);
    if (!leadRemote || link?.dropped) return;
    const fields = taskToRemote(
      { title: task.title, description: plainTextOf(task.description), dueDate: task.dueDate },
      leadRemote,
      await responsibleFor(ctx, task.assigneeEmail),
    );
    let remoteId: string;
    if (!link) {
      const added = await ctx.api.call<{ task?: Raw }>("tasks.task.add", { fields });
      remoteId = String(added?.task?.id ?? added?.task?.ID);
      if (task.done) await ctx.api.call("tasks.task.complete", { taskId: remoteId });
    } else {
      const remote = await fetchTask(ctx, link.remoteId);
      if (!remote) {
        await store.dropLink(link.id);
        return;
      }
      if (isNewer(remote.modifiedAt, link.remoteModifiedAt) && isNewer(remote.modifiedAt, task.updatedAt)) {
        await applyTask(ctx, remote, link);
        return;
      }
      await ctx.api.call("tasks.task.update", { taskId: link.remoteId, fields });
      if (task.done && !remote.done) await ctx.api.call("tasks.task.complete", { taskId: link.remoteId });
      if (!task.done && remote.done) await ctx.api.call("tasks.task.renew", { taskId: link.remoteId });
      remoteId = link.remoteId;
    }
    const after = await fetchTask(ctx, remoteId);
    await saveRecordLink(ctx, "TASK", task.id, remoteId, after?.modifiedAt ?? null, task.updatedAt);
    await store.clear(ctx.connection.id, "TASK", task.id);
  }

  async function pullTask(ctx: SyncContext, remoteId: string): Promise<PullOutcome> {
    const link = await store.linkByRemote(ctx.connection.id, "TASK", remoteId);
    if (link?.dropped) return "skipped";
    const remote = await fetchTask(ctx, remoteId);
    if (!remote) {
      if (link) await store.dropLink(link.id);
      return "skipped";
    }
    if (link) return (await applyTask(ctx, remote, link)) ? "updated" : "skipped";
    if (!remote.leadRemoteId) return "skipped";
    const leadLink = await store.linkByRemote(ctx.connection.id, "LEAD", remote.leadRemoteId);
    if (!leadLink || leadLink.dropped) return "skipped";
    const created = await store.createTask(ctx.connection.orgId, leadLink.localId, {
      title: remote.title,
      dueDate: remote.deadline,
      done: remote.done,
      assigneeId: await membershipFor(ctx, remote.responsibleId),
      description: remote.description ? documentOf(remote.description) : null,
    });
    await saveRecordLink(ctx, "TASK", created.id, remote.id, remote.modifiedAt, created.updatedAt);
    return "created";
  }

  const splitComment = (remoteId: string) => {
    const [taskId, itemId] = remoteId.split(":");
    return { taskId: taskId ?? "", itemId: itemId ?? "" };
  };

  async function pushComment(ctx: SyncContext, id: string): Promise<void> {
    const comment = await store.comment(id);
    if (!comment) return;
    const taskRemote = await remoteOf(ctx, "TASK", comment.taskId);
    const link = await store.link(ctx.connection.id, "COMMENT", id);
    if (!taskRemote || link?.dropped) return;
    const FIELDS = { POST_MESSAGE: noteToComment(comment.authorName, comment.body) };
    let remoteId = link?.remoteId;
    if (!remoteId) {
      const itemId = await ctx.api.call("task.commentitem.add", { TASKID: Number(taskRemote), FIELDS });
      remoteId = `${taskRemote}:${String(itemId)}`;
    } else {
      const { taskId, itemId } = splitComment(remoteId);
      try {
        await ctx.api.call("task.commentitem.update", { TASKID: Number(taskId), ITEMID: Number(itemId), FIELDS });
      } catch (error) {
        if (!missing(error)) throw error;
        await store.dropLink(link!.id);
        return;
      }
    }
    await saveRecordLink(ctx, "COMMENT", comment.id, remoteId, null, comment.watermark);
    await store.clear(ctx.connection.id, "COMMENT", comment.id);
  }

  async function pullComment(ctx: SyncContext, remoteId: string): Promise<PullOutcome> {
    const link = await store.linkByRemote(ctx.connection.id, "COMMENT", remoteId);
    if (link?.dropped) return "skipped";
    const { taskId, itemId } = splitComment(remoteId);
    if (!taskId || !itemId) return "skipped";
    const raw = await fetchRaw(ctx, "task.commentitem.get", { TASKID: Number(taskId), ITEMID: Number(itemId) });
    if (!raw) {
      if (link) await store.dropLink(link.id);
      return "skipped";
    }
    const text = String(raw.POST_MESSAGE ?? "").trim();
    if (!text) return "skipped";
    if (link) {
      const local = await store.comment(link.localId);
      if (!local) {
        await store.dropLink(link.id);
        return "skipped";
      }
      if (text === noteToComment(local.authorName, local.body)) return "skipped";
      const body = stripAuthor(text, local.authorName);
      if (body === local.body) return "skipped";
      const watermark = await store.updateComment(local.id, body);
      await saveRecordLink(ctx, "COMMENT", local.id, remoteId, null, watermark);
      return "updated";
    }
    const taskLink = await store.linkByRemote(ctx.connection.id, "TASK", taskId);
    if (!taskLink || taskLink.dropped) return "skipped";
    const author = typeof raw.AUTHOR_NAME === "string" && raw.AUTHOR_NAME.trim()
      ? raw.AUTHOR_NAME.trim()
      : await remoteUserName(ctx, raw.AUTHOR_ID);
    const created = await store.createComment(taskLink.localId, author ? `${author}: ${text}` : `${REMOTE_AUTHOR_PREFIX}${text}`);
    await saveRecordLink(ctx, "COMMENT", created.id, remoteId, null, created.watermark);
    return "created";
  }

  return {
    push(ctx: SyncContext, kind: SyncKind, id: string): Promise<void> {
      switch (kind) {
        case "LEAD": return pushRecord(ctx, kinds.LEAD, id);
        case "PERSON": return pushRecord(ctx, kinds.PERSON, id);
        case "COMPANY": return pushRecord(ctx, kinds.COMPANY, id);
        case "NOTE": return pushNote(ctx, id);
        case "TASK": return pushTask(ctx, id);
        case "COMMENT": return pushComment(ctx, id);
      }
    },
    pull(ctx: SyncContext, kind: SyncKind, remoteId: string): Promise<PullOutcome> {
      switch (kind) {
        case "LEAD": return pullRecord(ctx, kinds.LEAD, remoteId);
        case "PERSON": return pullRecord(ctx, kinds.PERSON, remoteId);
        case "COMPANY": return pullRecord(ctx, kinds.COMPANY, remoteId);
        case "NOTE": return pullNote(ctx, remoteId);
        case "TASK": return pullTask(ctx, remoteId);
        case "COMMENT": return pullComment(ctx, remoteId);
      }
    },
  };
}

export type SyncEngine = ReturnType<typeof createSyncEngine>;
