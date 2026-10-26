import { describe, expect, it } from "vitest";
import type { AddressedNotification } from "../../src/modules/notifications/index.js";
import {
  createTelegramNotificationRelay,
  notificationMessage,
  type BotReply,
} from "../../src/modules/telegram-bot/index.js";

const notification = (overrides: Partial<AddressedNotification> = {}): AddressedNotification => ({
  id: "n1",
  recipientId: "anna",
  kind: "TASK_ASSIGNED",
  createdAt: new Date("2026-10-26T10:00:00Z"),
  readAt: null,
  project: { id: "p1", name: "Клиника" },
  task: { id: "t1", title: "Макет <лендинга>", projectId: "p1", dueDate: null, dueTime: null },
  document: null,
  actor: { name: "Борис" },
  ...overrides,
});

const APP = "https://app.balagan.bi";

describe("a notification's Telegram message", () => {
  it("says what the app says, with the project, the actor and a link to the task", () => {
    const { html } = notificationMessage(notification(), APP);

    expect(html.split("\n")).toEqual([
      "Вас назначили участником задачи «<b>Макет &lt;лендинга&gt;</b>»",
      "Проект: Клиника",
      "От: Борис",
      "",
      `<a href="${APP}/tasks?task=t1">Открыть в Balagan BI</a>`,
    ]);
  });

  it("gives the deadline of a task that is due soon", () => {
    const { html } = notificationMessage(notification({
      kind: "TASK_DUE_SOON",
      actor: null,
      task: { id: "t1", title: "Отчёт", projectId: null, dueDate: "2026-10-27", dueTime: "18:00" },
      project: null,
    }), APP);

    expect(html).toContain("Подходит срок задачи «<b>Отчёт</b>»");
    expect(html).toContain("Срок: вт, 27 октября, 18:00");
    expect(html).not.toContain("От:");
  });

  it("opens a document in its project and a project on its page", () => {
    expect(notificationMessage(notification({
      kind: "DOCUMENT_ADDED", task: null, document: { id: "d1", title: "Бриф" },
    }), APP).html).toContain(`href="${APP}/projects/p1/documents/d1"`);
    expect(notificationMessage(notification({ kind: "KPI_MET", task: null, actor: null }), APP).html)
      .toContain(`Проект «<b>Клиника</b>» выполнил KPI`);
    expect(notificationMessage(notification({ kind: "PROJECT_CREATED", task: null }), APP).html)
      .toContain(`href="${APP}/projects/p1"`);
  });

  it("carries no link when the app's address is unknown", () => {
    expect(notificationMessage(notification(), null).html).not.toContain("<a ");
  });
});

describe("the Telegram relay", () => {
  function relay(chats: Record<string, number>, failing: number[] = []) {
    const sent: Array<{ chatId: number; reply: BotReply }> = [];
    const forward = createTelegramNotificationRelay({
      links: { chatFor: async (membershipId) => chats[membershipId] ?? null },
      api: {
        sendMessage: async (chatId, reply) => {
          if (failing.includes(chatId)) throw new Error("Forbidden: bot was blocked by the user");
          sent.push({ chatId, reply });
        },
      },
      render: (each) => ({ html: each.id }),
    });
    return { forward: forward.forward, sent };
  }

  it("sends each notification to its recipient's chat and skips members without one", async () => {
    const { forward, sent } = relay({ anna: 11, vera: 33 });

    await forward([
      notification({ id: "a", recipientId: "anna" }),
      notification({ id: "b", recipientId: "boris" }),
      notification({ id: "v", recipientId: "vera" }),
    ]);

    expect(sent).toEqual([{ chatId: 11, reply: { html: "a" } }, { chatId: 33, reply: { html: "v" } }]);
  });

  it("keeps sending to the others when one chat refuses, then reports the failure", async () => {
    const { forward, sent } = relay({ anna: 11, boris: 22, vera: 33 }, [22]);

    await expect(forward([
      notification({ id: "a", recipientId: "anna" }),
      notification({ id: "b", recipientId: "boris" }),
      notification({ id: "v", recipientId: "vera" }),
    ])).rejects.toThrow("1 of 3 notifications did not reach Telegram");
    expect(sent.map(({ chatId }) => chatId)).toEqual([11, 33]);
  });
});
