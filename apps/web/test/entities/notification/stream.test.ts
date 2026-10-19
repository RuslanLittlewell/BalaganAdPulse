import { http, HttpResponse } from "msw";
import {
  openNotificationStream,
  STREAM_BASE_DELAY_MS,
  type Notification,
} from "@/entities/notification/index.js";
import { clearTokens, writeTokens } from "@/shared/lib/index.js";
import { makeAccessToken, server } from "@test/shared/index.js";
import { FakeEventSource, fakeEventSource } from "@test/shared/eventSource.js";

const arrived: Notification = {
  id: "n1", kind: "TASK_ASSIGNED", createdAt: "2026-10-15T10:00:00.000Z", readAt: null,
  project: null, task: { id: "t1", title: "Позвонить клиенту", projectId: null, dueDate: null, dueTime: null },
  document: null, actor: { name: "Анна" },
};

function open() {
  const notifications: Notification[] = [];
  let reconnections = 0;
  const stream = openNotificationStream({
    createSource: fakeEventSource,
    onNotification: (notification) => notifications.push(notification),
    onReconnected: () => { reconnections += 1; },
  });
  return { stream, notifications, reconnections: () => reconnections };
}

beforeEach(() => {
  FakeEventSource.reset();
  writeTokens({ accessToken: makeAccessToken(), refreshToken: "test-refresh" });
});

afterEach(() => {
  vi.useRealTimers();
  clearTokens();
});

describe("the notification stream", () => {
  it("listens on the stream path and hands over each notification", () => {
    const { notifications } = open();
    const source = FakeEventSource.latest();

    source.emit("ready", {});
    source.emit("notification", arrived);
    source.emit("notification", "not json");
    source.emit("notification", { id: "n2", kind: "UNKNOWN" });

    expect(source.url).toBe("/api/notifications/stream");
    expect(notifications).toEqual([arrived]);
  });

  it("asks for a refresh of the list only after a reconnection", () => {
    const { reconnections } = open();
    const source = FakeEventSource.latest();

    source.emit("ready", {});
    expect(reconnections()).toBe(0);

    source.drop();
    source.emit("ready", {});
    expect(reconnections()).toBe(1);
    expect(FakeEventSource.instances).toHaveLength(1);
  });

  it("renews the session and opens a new stream when the browser gives up", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let refreshed = 0;
    server.use(http.post("/api/auth/refresh", () => {
      refreshed += 1;
      return HttpResponse.json({ ok: true });
    }));
    const { reconnections } = open();
    FakeEventSource.latest().emit("ready", {});

    FakeEventSource.latest().fail();
    await vi.advanceTimersByTimeAsync(STREAM_BASE_DELAY_MS);

    await vi.waitFor(() => expect(FakeEventSource.instances).toHaveLength(2));
    expect(refreshed).toBe(1);
    FakeEventSource.latest().emit("ready", {});
    expect(reconnections()).toBe(1);
  });

  it("opens nothing without a session and closes for good", async () => {
    clearTokens();
    open();
    expect(FakeEventSource.instances).toHaveLength(0);

    writeTokens({ accessToken: makeAccessToken(), refreshToken: "test-refresh" });
    vi.useFakeTimers();
    const { stream } = open();
    const source = FakeEventSource.latest();
    source.fail();
    stream.close();
    await vi.advanceTimersByTimeAsync(STREAM_BASE_DELAY_MS * 4);

    expect(source.closed).toBe(true);
    expect(FakeEventSource.instances).toHaveLength(1);
  });
});
