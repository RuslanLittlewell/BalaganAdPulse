import { http, HttpResponse } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes, useLocation } from "react-router-dom";
import { renderWithProviders, server } from "@test/shared/index.js";
import { FakeEventSource } from "@test/shared/eventSource.js";
import type { Notification } from "@/entities/notification/index.js";
import { TooltipProvider } from "@/shared/ui/index.js";
import { NotificationCenter } from "@/widgets/notification-center/index.js";

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

const kpiMet: Notification = {
  id: "n1", kind: "KPI_MET", createdAt: minutesAgo(5), readAt: null,
  project: { id: "p1", name: "Клиника" }, task: null, actor: null,
};
const newProject: Notification = {
  id: "n2", kind: "PROJECT_CREATED", createdAt: minutesAgo(60), readAt: "2026-10-15T10:00:00.000Z",
  project: { id: "p2", name: "Автосалон" }, task: null, actor: { name: "Анна" },
};
const assigned: Notification = {
  id: "n3", kind: "TASK_ASSIGNED", createdAt: minutesAgo(120), readAt: null,
  project: { id: "p1", name: "Клиника" }, task: { id: "t1", title: "Позвонить клиенту", projectId: "p1" },
  actor: { name: "Борис" },
};

function Where() {
  const location = useLocation();
  return <output aria-label="Адрес">{`${location.pathname}${location.search}`}</output>;
}

function setup() {
  return renderWithProviders(
    <TooltipProvider>
      <NotificationCenter />
      <Routes>
        <Route path="*" element={<Where />} />
      </Routes>
    </TooltipProvider>,
  );
}

function serve(initial: Notification[]) {
  let notifications = initial.map((notification) => ({ ...notification }));
  const asked = { list: 0, read: [] as string[], readAll: 0 };
  const now = "2026-10-15T12:00:00.000Z";
  server.use(
    http.get("/api/notifications", () => {
      asked.list += 1;
      const unreadCount = notifications.filter((notification) => notification.readAt === null).length;
      return HttpResponse.json({ notifications, unreadCount });
    }),
    http.post("/api/notifications/:id/read", ({ params }) => {
      asked.read.push(String(params.id));
      notifications = notifications.map((n) => (n.id === params.id ? { ...n, readAt: n.readAt ?? now } : n));
      return new HttpResponse(null, { status: 204 });
    }),
    http.post("/api/notifications/read-all", () => {
      asked.readAll += 1;
      notifications = notifications.map((n) => ({ ...n, readAt: n.readAt ?? now }));
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return asked;
}

const bell = () => screen.findByRole("button", { name: "Уведомления" });

beforeEach(() => {
  FakeEventSource.reset();
  vi.stubGlobal("EventSource", FakeEventSource);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("NotificationCenter", () => {
  it("carries no dot and says so when there is nothing", async () => {
    serve([]);
    setup();

    await userEvent.click(await bell());

    expect(await screen.findByText("Уведомлений пока нет")).toBeInTheDocument();
    expect(await bell()).toHaveAttribute("data-unread", "false");
    expect(await bell()).not.toHaveAccessibleDescription();
    expect(screen.queryByRole("button", { name: "Прочитать все" })).not.toBeInTheDocument();
  });

  it("lights the dot while something is unread and lists the notifications newest first", async () => {
    serve([kpiMet, newProject, assigned]);
    setup();

    await waitFor(async () => expect(await bell()).toHaveAttribute("data-unread", "true"));
    expect(await bell()).toHaveAccessibleDescription("Есть непрочитанные уведомления");
    await userEvent.click(await bell());

    const items = await screen.findAllByRole("listitem");
    expect(items.map((item) => item.querySelector("button")!.getAttribute("data-unread"))).toEqual(["true", "false", "true"]);
    expect(within(items[0]!).getByText("Проект «Клиника» выполнил KPI")).toBeInTheDocument();
    expect(within(items[0]!).getByText("5 минут назад")).toBeInTheDocument();
    expect(within(items[1]!).getByText("Новый проект «Автосалон»")).toBeInTheDocument();
    expect(within(items[1]!).getByText(/^Анна · /)).toBeInTheDocument();
    expect(within(items[2]!).getByText("Вас назначили участником задачи «Позвонить клиенту»")).toBeInTheDocument();
    expect(within(items[2]!).getByText(/^Борис · /)).toBeInTheDocument();
  });

  it("reads a task notification and opens the task", async () => {
    const asked = serve([assigned]);
    setup();

    await userEvent.click(await bell());
    await userEvent.click(await screen.findByRole("button", { name: /Вас назначили участником задачи/ }));

    expect(screen.getByRole("status", { name: "Адрес" })).toHaveTextContent("/tasks?task=t1");
    await waitFor(() => expect(asked.read).toEqual(["n3"]));
  });

  it("opens the project of a project notification without reading it again", async () => {
    const asked = serve([newProject]);
    setup();

    await userEvent.click(await bell());
    await userEvent.click(await screen.findByRole("button", { name: /Новый проект «Автосалон»/ }));

    expect(screen.getByRole("status", { name: "Адрес" })).toHaveTextContent("/projects/p2");
    expect(asked.read).toEqual([]);
  });

  it("reads them all and puts the dot out", async () => {
    const asked = serve([kpiMet, assigned]);
    setup();

    await userEvent.click(await bell());
    await userEvent.click(await screen.findByRole("button", { name: "Прочитать все" }));

    await waitFor(() => expect(asked.readAll).toBe(1));
    expect(await bell()).toHaveAttribute("data-unread", "false");
  });

  it("puts a streamed notification on top and lights the dot", async () => {
    serve([newProject]);
    setup();
    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
    await userEvent.click(await bell());
    await screen.findByText("Новый проект «Автосалон»");

    FakeEventSource.latest().emit("ready", {});
    FakeEventSource.latest().emit("notification", kpiMet);

    await waitFor(async () => expect(await bell()).toHaveAttribute("data-unread", "true"));
    const items = screen.getAllByRole("listitem");
    expect(within(items[0]!).getByText("Проект «Клиника» выполнил KPI")).toBeInTheDocument();
  });

  it("refreshes the list after the stream reconnects", async () => {
    const asked = serve([]);
    setup();
    await waitFor(() => expect(asked.list).toBe(1));
    const source = FakeEventSource.latest();

    source.emit("ready", {});
    source.drop();
    source.emit("ready", {});

    await waitFor(() => expect(asked.list).toBe(2));
  });
});
