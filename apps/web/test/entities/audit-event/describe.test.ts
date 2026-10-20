import { describeAuditEvent, type AuditAction, type AuditEvent } from "@/entities/audit-event/index.js";

const event = (summary: string, fields: Partial<AuditEvent> = {}): AuditEvent => ({
  id: "e1", orgId: "o1", actorId: "m1", actorName: "Мария", actorEmail: "m@example.com", actorRole: "MANAGER",
  action: "UPDATE" as AuditAction, entityType: "task", entityId: "t1", clientId: null, projectId: null, campaignId: null,
  summary, changes: null, requestId: null, ip: null, userAgent: null, createdAt: "2026-10-20T10:00:00.000Z",
  ...fields,
});

const read = (summary: string, fields: Partial<AuditEvent> = {}) => describeAuditEvent(event(summary, fields));

describe("reading an audit event in Russian", () => {
  it.each([
    ["Created task “Создать задачу”", "task", { subject: "Задача", name: "Создать задачу", detail: null }],
    ["Deleted client “Евроторг”", "client", { subject: "Клиент", name: "Евроторг", detail: null }],
    ["Updated project “SonnScape”", "project", { subject: "Проект", name: "SonnScape", detail: null }],
    ["Updated picture for project “Meta”", "project", { subject: "Проект", name: "Meta", detail: "новое изображение" }],
    ["Moved task “123” from IDEA to IN_PROGRESS", "task", { subject: "Задача", name: "123", detail: "Идея → В работе" }],
    ["Completed task “Отчёт” of 2026-10-20, due next on 2026-10-27", "task", { subject: "Задача", name: "Отчёт", detail: "выполнена, следующий срок 27 окт." }],
    ["Changed the summary of project “Meta”", "project", { subject: "Проект", name: "Meta", detail: "плитки сводки" }],
    ["Renamed document “Бриф” to “Бриф v2”", "project-document", { subject: "Документ", name: "Бриф v2", detail: "было «Бриф»" }],
    ["Generated the 2026-09 report", "report", { subject: "Отчёт", name: "сентябрь 2026", detail: null }],
    ["Published the 2026-09 report", "report", { subject: "Отчёт", name: "сентябрь 2026", detail: "опубликован" }],
    ["Set project KPI", "project", { subject: "KPI проекта", name: null, detail: null }],
    ["Cleared organization KPI", "organization", { subject: "KPI организации", name: null, detail: "сброшен" }],
    ["Connected Meta advertising account", "project", { subject: "Рекламный аккаунт Meta", name: null, detail: "подключён" }],
    ["UPDATE lead column", "lead-column", { subject: "Колонка CRM", name: null, detail: null }],
  ])("reads «%s»", (summary, entityType, expected) => {
    expect(read(summary, { entityType })).toEqual(expected);
  });

  it("names the file added to or removed from a lead", () => {
    expect(read("UPDATE lead", { entityType: "lead", changes: { fileAdded: { id: "f", name: "КП.pdf" } } as never }))
      .toEqual({ subject: "Лид", name: null, detail: "добавлен файл «КП.pdf»" });
    expect(read("UPDATE lead", { entityType: "lead", changes: { fileRemoved: { id: "f", name: "КП.pdf" } } as never })?.detail)
      .toBe("удалён файл «КП.pdf»");
    expect(read("CREATE lead", { entityType: "lead" })?.detail).toBeNull();
  });

  it("leaves a summary it does not know to be shown as it is", () => {
    expect(read("Изменён день 31 августа", { entityType: "campaignRecord" })).toBeNull();
  });
});
