import { withAllRead, withArrived, withOneRead, type Notification } from "@/entities/notification/index.js";

const notification = (id: string, readAt: string | null = null): Notification => ({
  id, kind: "KPI_MET", createdAt: "2026-10-15T10:00:00.000Z", readAt,
  project: { id: "p1", name: "Клиника" }, task: null, document: null, actor: null,
});

const READ_AT = "2026-10-15T12:00:00.000Z";

describe("the cached list of notifications", () => {
  it("puts an arrival on top and counts it unread, once", () => {
    const list = { notifications: [notification("a")], unreadCount: 1 };

    const arrived = withArrived(list, notification("b"));

    expect(arrived.notifications.map((n) => n.id)).toEqual(["b", "a"]);
    expect(arrived.unreadCount).toBe(2);
    expect(withArrived(arrived, notification("b"))).toEqual(arrived);
  });

  it("moves a refreshed notification to the top without counting it twice", () => {
    const list = { notifications: [notification("a"), notification("b")], unreadCount: 2 };

    const refreshed = withArrived(list, { ...notification("b"), actor: { name: "Вера" } });

    expect(refreshed.notifications.map((n) => n.id)).toEqual(["b", "a"]);
    expect(refreshed.notifications[0]?.actor).toEqual({ name: "Вера" });
    expect(refreshed.unreadCount).toBe(2);
  });

  it("keeps the latest fifty", () => {
    const list = { notifications: Array.from({ length: 50 }, (_, i) => notification(`n${i}`)), unreadCount: 50 };

    const arrived = withArrived(list, notification("new"));

    expect(arrived.notifications).toHaveLength(50);
    expect(arrived.notifications[0]?.id).toBe("new");
    expect(arrived.unreadCount).toBe(51);
  });

  it("reads one unread notification and leaves a read one alone", () => {
    const list = { notifications: [notification("a"), notification("b", READ_AT)], unreadCount: 3 };

    const read = withOneRead(list, "a", READ_AT);

    expect(read.notifications[0]?.readAt).toBe(READ_AT);
    expect(read.unreadCount).toBe(2);
    expect(withOneRead(read, "b", READ_AT)).toBe(read);
  });

  it("reads them all", () => {
    const list = { notifications: [notification("a"), notification("b", READ_AT)], unreadCount: 7 };

    const read = withAllRead(list, "2026-10-16T00:00:00.000Z");

    expect(read.unreadCount).toBe(0);
    expect(read.notifications.map((n) => n.readAt)).toEqual(["2026-10-16T00:00:00.000Z", READ_AT]);
  });
});
