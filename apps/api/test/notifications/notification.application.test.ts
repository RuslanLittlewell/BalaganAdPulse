import { describe, expect, it } from "vitest";
import type { ActorContext } from "../../src/shared/application/index.js";
import { AppError } from "../../src/shared/domain/app-error.js";
import {
  createNotificationHub,
  createNotificationUseCases,
  type DueTask,
  type NewNotification,
  type NotificationView,
} from "../../src/modules/notifications/index.js";
import type { KpiFigures, KpiInput } from "../../src/modules/kpi/index.js";

const anna: ActorContext = { userId: "u1", membershipId: "anna", orgId: "org1", role: "ADMIN" };

const figures: KpiFigures = {
  spend: 1000, impressions: 100000, reach: 40000, clicks: 2000, conversions: 30, results: 50, revenue: 4000,
  ctr: 2, cpc: 0.5, cpm: 10, cpa: 10, costPerResult: 20, roas: 4, frequency: 2.5,
};

function fixture(options: {
  staff?: string[];
  members?: Array<{ id: string; customer: boolean }>;
  kpi?: KpiInput | null;
  conversions?: number;
  now?: Date;
  unread?: string[];
  due?: DueTask[];
} = {}) {
  const created: NewNotification[] = [];
  const refreshed: NewNotification[] = [];
  const dueClaimed = new Set<string>();
  const readsAsked: Array<{ projectId: string; range: { from: string; to: string } }> = [];
  const claimed = new Set<string>();
  const hub = createNotificationHub();
  const useCases = createNotificationUseCases({
    notifications: {
      createMany: async (drafts) => drafts.map((draft, index) => {
        created.push(draft);
        return {
          id: `n${created.length}-${index}`, kind: draft.kind, createdAt: new Date(), readAt: null,
          project: null, task: null, document: null, actor: null, recipientId: draft.recipientId,
        };
      }),
      refreshUnread: async (draft) => {
        if (!(options.unread ?? []).includes(draft.recipientId)) return null;
        refreshed.push(draft);
        return {
          id: `unread-${draft.recipientId}`, kind: draft.kind, createdAt: new Date(), readAt: null,
          project: null, task: null, document: null, actor: null, recipientId: draft.recipientId,
        };
      },
      latest: async () => [],
      unreadCount: async () => 0,
      markRead: async (recipientId, id) => recipientId === "anna" && id === "mine",
      markAllRead: async () => {},
    },
    recipients: {
      staffReaching: async () => options.staff ?? ["anna", "boris", "vera"],
      activeMembers: async (ids) => (options.members ?? ids.map((id) => ({ id, customer: false })))
        .filter((member) => ids.includes(member.id)),
    },
    standings: {
      read: async (projectId, range) => {
        readsAsked.push({ projectId, range });
        const kpi = options.kpi === undefined ? { metric: "CONVERSIONS", target: "62.0000" } as const : options.kpi;
        return kpi ? { kpi, figures: { ...figures, conversions: options.conversions ?? 30 } } : null;
      },
    },
    claims: {
      claim: async (projectId, month) => {
        const key = `${projectId}:${month}`;
        if (claimed.has(key)) return false;
        claimed.add(key);
        return true;
      },
    },
    dueTasks: {
      dueBetween: async (fromDay, toDay) =>
        (options.due ?? []).filter((task) => task.dueDate >= fromDay && task.dueDate <= toDay),
      claim: async (taskId, deadline) => {
        const key = `${taskId}:${deadline.toISOString()}`;
        if (dueClaimed.has(key)) return false;
        dueClaimed.add(key);
        return true;
      },
    },
    hub,
    clock: { now: () => options.now ?? new Date("2026-10-15T12:00:00Z") },
    timeZone: "Europe/Minsk",
  });
  return { useCases, created, refreshed, readsAsked, hub };
}

const recipientsOf = (created: NewNotification[]) => created.map((notification) => notification.recipientId);

describe("a new project", () => {
  it("is told to everyone on the project's staff but the one who created it", async () => {
    const { useCases, created } = fixture();

    await useCases.projectCreated({ id: "p1" }, anna);

    expect(recipientsOf(created)).toEqual(["boris", "vera"]);
    expect(created[0]).toEqual({
      recipientId: "boris", kind: "PROJECT_CREATED", projectId: "p1", taskId: null, documentId: null, actorId: "anna",
    });
  });
});

describe("being named on a task", () => {
  const task = { id: "t1", projectId: "p1", visibleToClient: false };

  it("is told to each named member but the one who named them", async () => {
    const { useCases, created } = fixture();

    await useCases.participantsNamed(task, ["boris", "anna"], anna);

    expect(created).toEqual([
      { recipientId: "boris", kind: "TASK_ASSIGNED", projectId: "p1", taskId: "t1", documentId: null, actorId: "anna" },
    ]);
  });

  it("tells nobody when only the actor was named", async () => {
    const { useCases, created } = fixture();

    await useCases.participantsNamed(task, ["anna"], anna);

    expect(created).toEqual([]);
  });

  it("tells a client's person only about a task shown to the client", async () => {
    const members = [{ id: "boris", customer: false }, { id: "client", customer: true }];
    const hidden = fixture({ members });
    await hidden.useCases.participantsNamed(task, ["boris", "client"], anna);
    expect(recipientsOf(hidden.created)).toEqual(["boris"]);

    const shown = fixture({ members });
    await shown.useCases.participantsNamed({ ...task, visibleToClient: true }, ["boris", "client"], anna);
    expect(recipientsOf(shown.created)).toEqual(["boris", "client"]);
  });

  it("leaves out a member who is no longer active", async () => {
    const { useCases, created } = fixture({ members: [{ id: "boris", customer: false }] });

    await useCases.participantsNamed(task, ["boris", "suspended"], anna);

    expect(recipientsOf(created)).toEqual(["boris"]);
  });
});

describe("a change to a task", () => {
  const task = { id: "t1", projectId: "p1", visibleToClient: false, participantIds: ["anna", "boris", "vera"] };

  it("is told to its participants but the one who changed it and those it named", async () => {
    const { useCases, created } = fixture();

    await useCases.taskChanged(task, anna, ["vera"]);

    expect(created).toEqual([
      { recipientId: "boris", kind: "TASK_UPDATED", projectId: "p1", taskId: "t1", documentId: null, actorId: "anna" },
    ]);
  });

  it("refreshes an unread notification about it instead of adding one, and delivers the refreshed one", async () => {
    const { useCases, created, refreshed } = fixture({ unread: ["boris"] });
    const toBoris: NotificationView[] = [];
    useCases.subscribe({ ...anna, membershipId: "boris" }, { deliver: (n) => toBoris.push(n), end: () => {} });

    await useCases.taskChanged(task, anna, []);

    expect(recipientsOf(refreshed)).toEqual(["boris"]);
    expect(recipientsOf(created)).toEqual(["vera"]);
    expect(toBoris.map((n) => n.id)).toEqual(["unread-boris"]);
  });

  it("tells a client's person only about a task shown to the client", async () => {
    const members = [{ id: "boris", customer: false }, { id: "client", customer: true }];
    const { useCases, created } = fixture({ members });

    await useCases.taskChanged({ ...task, participantIds: ["boris", "client"] }, anna, []);

    expect(recipientsOf(created)).toEqual(["boris"]);
  });
});

describe("a new document", () => {
  it("is told to the project's staff but the one who added it", async () => {
    const { useCases, created } = fixture();

    await useCases.documentAdded({ id: "d1", projectId: "p1" }, anna);

    expect(created).toEqual([
      { recipientId: "boris", kind: "DOCUMENT_ADDED", projectId: "p1", taskId: null, documentId: "d1", actorId: "anna" },
      { recipientId: "vera", kind: "DOCUMENT_ADDED", projectId: "p1", taskId: null, documentId: "d1", actorId: "anna" },
    ]);
  });
});

describe("a deadline drawing near", () => {
  const due = (partial: Partial<DueTask> = {}): DueTask => ({
    id: "t1", projectId: "p1", dueDate: "2026-10-20", dueTime: "18:00",
    participantIds: ["boris"], createdById: "anna", visibleToClient: false, ...partial,
  });
  const minsk = (wallClock: string) => new Date(`${wallClock}+03:00`);

  it("is told once the deadline is less than a day away", async () => {
    const early = fixture({ due: [due()], now: minsk("2026-10-19T17:50:00") });
    expect(await early.useCases.remindDueTasks()).toBe(0);
    expect(early.created).toEqual([]);

    const inTime = fixture({ due: [due()], now: minsk("2026-10-19T18:10:00") });
    expect(await inTime.useCases.remindDueTasks()).toBe(1);
    expect(inTime.created).toEqual([
      { recipientId: "boris", kind: "TASK_DUE_SOON", projectId: "p1", taskId: "t1", documentId: null, actorId: null },
    ]);
  });

  it("reads a due date without a time as its end", async () => {
    const { useCases, created } = fixture({ due: [due({ dueTime: null })], now: minsk("2026-10-20T00:10:00") });

    await useCases.remindDueTasks();

    expect(recipientsOf(created)).toEqual(["boris"]);
  });

  it("tells nobody once the deadline has passed", async () => {
    const { useCases, created } = fixture({ due: [due()], now: minsk("2026-10-20T18:01:00") });

    await useCases.remindDueTasks();

    expect(created).toEqual([]);
  });

  it("tells once per deadline", async () => {
    const { useCases, created } = fixture({ due: [due()], now: minsk("2026-10-19T20:00:00") });

    await useCases.remindDueTasks();
    await useCases.remindDueTasks();

    expect(recipientsOf(created)).toEqual(["boris"]);
  });

  it("tells the creator of a task that names nobody", async () => {
    const { useCases, created } = fixture({ due: [due({ participantIds: [] })], now: minsk("2026-10-19T20:00:00") });

    await useCases.remindDueTasks();

    expect(recipientsOf(created)).toEqual(["anna"]);
  });

  it("tells a client's person only about a task shown to the client", async () => {
    const members = [{ id: "boris", customer: false }, { id: "client", customer: true }];
    const hidden = fixture({ members, due: [due({ participantIds: ["boris", "client"] })], now: minsk("2026-10-19T20:00:00") });

    await hidden.useCases.remindDueTasks();

    expect(recipientsOf(hidden.created)).toEqual(["boris"]);
  });
});

describe("a project's KPI being met", () => {
  it("judges the month to date and tells the project's staff", async () => {
    const { useCases, created, readsAsked } = fixture();

    await useCases.projectKpiChanged("p1", null);

    expect(readsAsked[0]?.range).toEqual({ from: "2026-10-01", to: "2026-10-15" });
    expect(recipientsOf(created)).toEqual(["anna", "boris", "vera"]);
    expect(created[0]).toMatchObject({ kind: "KPI_MET", projectId: "p1", taskId: null, actorId: null });
  });

  it("leaves out the member whose change met it", async () => {
    const { useCases, created } = fixture();

    await useCases.projectKpiChanged("p1", anna);

    expect(recipientsOf(created)).toEqual(["boris", "vera"]);
  });

  it("tells nobody while the marker is not green", async () => {
    const { useCases, created } = fixture({ conversions: 29 });

    await useCases.projectKpiChanged("p1", null);

    expect(created).toEqual([]);
  });

  it("tells nobody about a project without a KPI", async () => {
    const { useCases, created } = fixture({ kpi: null });

    await useCases.projectKpiChanged("p1", null);

    expect(created).toEqual([]);
  });

  it("tells once a month, however often it is met again", async () => {
    const { useCases, created } = fixture({ staff: ["boris"] });

    await useCases.projectKpiChanged("p1", null);
    await useCases.projectKpiChanged("p1", null);

    expect(recipientsOf(created)).toEqual(["boris"]);
  });
});

describe("delivery and reading", () => {
  it("hands each created notification to its recipient's subscribers only", async () => {
    const { useCases, hub } = fixture();
    const toBoris: NotificationView[] = [];
    const toAnna: NotificationView[] = [];
    useCases.subscribe({ ...anna, membershipId: "boris" }, { deliver: (n) => toBoris.push(n), end: () => {} });
    useCases.subscribe(anna, { deliver: (n) => toAnna.push(n), end: () => {} });

    await useCases.projectCreated({ id: "p1" }, anna);

    expect(toBoris).toHaveLength(1);
    expect(toBoris[0]).not.toHaveProperty("recipientId");
    expect(toAnna).toEqual([]);
    expect(hub.size()).toBe(2);
  });

  it("ends every subscriber when the hub closes", () => {
    const { useCases, hub } = fixture();
    let ended = 0;
    useCases.subscribe(anna, { deliver: () => {}, end: () => { ended += 1; } });
    useCases.subscribe(anna, { deliver: () => {}, end: () => { ended += 1; } });

    hub.closeAll();

    expect(ended).toBe(2);
    expect(hub.size()).toBe(0);
  });

  it("answers not-found for a notification that is not the member's", async () => {
    const { useCases } = fixture();

    await expect(useCases.read(anna, "mine")).resolves.toBeUndefined();
    await expect(useCases.read(anna, "theirs")).rejects.toMatchObject(new AppError("not-found", "Notification not found"));
  });
});
