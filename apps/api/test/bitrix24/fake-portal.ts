import { Bitrix24Error } from "../../src/modules/bitrix24/index.js";
import type { Bitrix24Api } from "../../src/modules/bitrix24/index.js";

type Raw = Record<string, unknown>;

interface Failure {
  method: string | null;
  error: Bitrix24Error;
  times: number;
}

const missing = () => new Bitrix24Error("NOT_FOUND", "Not found");

export class FakePortal implements Bitrix24Api {
  readonly entities = { lead: new Map<string, Raw>(), contact: new Map<string, Raw>(), company: new Map<string, Raw>() };
  readonly comments = new Map<string, Raw>();
  readonly tasks = new Map<string, Raw>();
  readonly taskComments = new Map<string, Raw>();
  readonly users: Raw[] = [];
  readonly statuses = [
    { STATUS_ID: "NEW", NAME: "Не обработан" },
    { STATUS_ID: "IN_PROCESS", NAME: "В работе" },
    { STATUS_ID: "PROCESSED", NAME: "Обработан" },
  ];
  readonly calls: Array<{ method: string; params: Raw }> = [];
  private failures: Failure[] = [];
  private sequence = 100;

  private nextId(): string {
    this.sequence += 1;
    return String(this.sequence);
  }

  private stamp(): string {
    return new Date().toISOString();
  }

  failWith(error: Bitrix24Error, method: string | null = null, times = Number.POSITIVE_INFINITY): void {
    this.failures.push({ method, error, times });
  }

  heal(): void {
    this.failures = [];
  }

  writes(prefix = ""): string[] {
    return this.calls
      .map((call) => call.method)
      .filter((method) => method.startsWith(prefix) && /\.(add|update|complete|renew)$/.test(method));
  }

  seed(entity: "lead" | "contact" | "company", fields: Raw, created = this.stamp()): string {
    const id = this.nextId();
    this.entities[entity].set(id, { ...fields, ID: id, DATE_CREATE: created, DATE_MODIFY: this.stamp() });
    return id;
  }

  edit(entity: "lead" | "contact" | "company", id: string, fields: Raw): void {
    const current = this.entities[entity].get(id);
    if (!current) throw new Error(`No ${entity} ${id}`);
    this.entities[entity].set(id, { ...current, ...fields, DATE_MODIFY: this.stamp() });
  }

  seedTask(fields: Raw): string {
    const id = this.nextId();
    this.tasks.set(id, { id, status: "2", ...fields, changedDate: this.stamp() });
    return id;
  }

  editTask(id: string, fields: Raw): void {
    this.tasks.set(id, { ...this.tasks.get(id)!, ...fields, changedDate: this.stamp() });
  }

  seedComment(fields: Raw): string {
    const id = this.nextId();
    this.comments.set(id, { ID: id, ...fields });
    return id;
  }

  seedTaskComment(taskId: string, fields: Raw): string {
    const id = this.nextId();
    this.taskComments.set(`${taskId}:${id}`, { ID: id, TASK_ID: taskId, ...fields });
    return `${taskId}:${id}`;
  }

  async call<T = unknown>(method: string, params: Raw = {}): Promise<T> {
    this.calls.push({ method, params });
    const failure = this.failures.find((entry) => entry.times > 0 && (entry.method === null || entry.method === method));
    if (failure) {
      failure.times -= 1;
      throw failure.error;
    }
    return this.answer(method, params) as T;
  }

  async list<T = unknown>(method: string, params: Raw = {}): Promise<{ items: T[]; next: number | null }> {
    this.calls.push({ method, params });
    const entity = /^crm\.(lead|contact|company)\.list$/.exec(method)?.[1] as "lead" | "contact" | "company" | undefined;
    if (!entity) throw new Error(`Unexpected list ${method}`);
    const start = Number(params.start ?? 0);
    const filter = (params.filter ?? {}) as Raw;
    const select = Array.isArray(params.select) ? params.select.map(String) : ["ID"];
    const matches = (row: Raw) => Object.entries(filter).every(([key, value]) =>
      key.startsWith("=")
        ? String(row[key.slice(1)] ?? "").toLowerCase() === String(value).toLowerCase()
        : String(row[key]) === String(value));
    const all = [...this.entities[entity].values()].filter(matches).sort((a, b) => Number(a.ID) - Number(b.ID));
    const page = all.slice(start, start + 50).map((row) => Object.fromEntries(select.filter((field) => field in row).map((field) => [field, row[field]])));
    return { items: page as T[], next: start + 50 < all.length ? start + 50 : null };
  }

  private answer(method: string, params: Raw): unknown {
    const crud = /^crm\.(lead|contact|company)\.(add|get|update)$/.exec(method);
    if (crud) {
      const store = this.entities[crud[1] as "lead" | "contact" | "company"];
      const fields = (params.fields ?? {}) as Raw;
      if (crud[2] === "add") {
        const id = this.nextId();
        store.set(id, { ...fields, ID: id, DATE_CREATE: this.stamp(), DATE_MODIFY: this.stamp() });
        return Number(id);
      }
      const id = String(params.id);
      const current = store.get(id);
      if (!current) throw missing();
      if (crud[2] === "get") return { ...current };
      store.set(id, { ...current, ...fields, DATE_MODIFY: this.stamp() });
      return true;
    }
    switch (method) {
      case "crm.duplicate.findbycomm": {
        const type = String(params.type);
        const keyOf = (value: unknown) => type === "PHONE" ? String(value ?? "").replace(/\D/g, "") : String(value ?? "").trim().toLowerCase();
        const wanted = new Set((Array.isArray(params.values) ? params.values : []).map(keyOf));
        const ids = [...this.entities.contact.values()]
          .filter((row) => (Array.isArray(row[type]) ? row[type] as Raw[] : []).some((item) => wanted.has(keyOf(item.VALUE))))
          .map((row) => Number(row.ID));
        return ids.length === 0 ? [] : { CONTACT: ids };
      }
      case "profile":
        return { ID: "1", ADMIN: true };
      case "crm.status.list":
        return this.statuses;
      case "user.get": {
        const filter = (params.FILTER ?? {}) as Raw;
        return this.users.filter((user) =>
          (filter.ID === undefined || String(user.ID) === String(filter.ID))
          && (filter.EMAIL === undefined || String(user.EMAIL).toLowerCase() === String(filter.EMAIL).toLowerCase()));
      }
      case "crm.timeline.comment.add": {
        const id = this.nextId();
        this.comments.set(id, { ID: id, AUTHOR_ID: "1", ...(params.fields as Raw) });
        return Number(id);
      }
      case "crm.timeline.comment.get": {
        const comment = this.comments.get(String(params.id));
        if (!comment) throw missing();
        return { ...comment };
      }
      case "crm.timeline.comment.update": {
        const id = String(params.id);
        if (!this.comments.has(id)) throw missing();
        this.comments.set(id, { ...this.comments.get(id), ...(params.fields as Raw) });
        return true;
      }
      case "tasks.task.add": {
        const fields = params.fields as Raw;
        const id = this.nextId();
        const task = {
          id, title: fields.TITLE, description: fields.DESCRIPTION, deadline: fields.DEADLINE || null, status: "2",
          responsibleId: fields.RESPONSIBLE_ID ?? "1", ufCrmTask: fields.UF_CRM_TASK, changedDate: this.stamp(),
        };
        this.tasks.set(id, task);
        return { task };
      }
      case "tasks.task.get": {
        const task = this.tasks.get(String(params.taskId));
        if (!task) throw missing();
        return { task: { ...task } };
      }
      case "tasks.task.update": {
        const id = String(params.taskId);
        const fields = params.fields as Raw;
        if (!this.tasks.has(id)) throw missing();
        this.editTask(id, {
          title: fields.TITLE, description: fields.DESCRIPTION, deadline: fields.DEADLINE || null, ufCrmTask: fields.UF_CRM_TASK,
          ...(fields.RESPONSIBLE_ID ? { responsibleId: fields.RESPONSIBLE_ID } : {}),
        });
        return { task: this.tasks.get(id) };
      }
      case "tasks.task.complete":
        this.editTask(String(params.taskId), { status: "5" });
        return { task: this.tasks.get(String(params.taskId)) };
      case "tasks.task.renew":
        this.editTask(String(params.taskId), { status: "2" });
        return { task: this.tasks.get(String(params.taskId)) };
      case "task.commentitem.add": {
        const taskId = String(params.TASKID);
        const id = this.nextId();
        this.taskComments.set(`${taskId}:${id}`, { ID: id, TASK_ID: taskId, AUTHOR_ID: "1", ...(params.FIELDS as Raw) });
        return Number(id);
      }
      case "task.commentitem.get": {
        const comment = this.taskComments.get(`${String(params.TASKID)}:${String(params.ITEMID)}`);
        if (!comment) throw missing();
        return { ...comment };
      }
      case "task.commentitem.update": {
        const key = `${String(params.TASKID)}:${String(params.ITEMID)}`;
        if (!this.taskComments.has(key)) throw missing();
        this.taskComments.set(key, { ...this.taskComments.get(key), ...(params.FIELDS as Raw) });
        return true;
      }
      default:
        throw new Error(`Unexpected Bitrix24 method ${method}`);
    }
  }
}
