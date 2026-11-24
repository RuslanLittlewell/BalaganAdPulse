import { describeAuditEvent, type AuditAction, type AuditEvent } from "@/entities/audit-event/index.js";

const event = (summary: string, fields: Partial<AuditEvent> = {}): AuditEvent => ({
  id: "e1", orgId: "o1", actorId: "m1", actorName: "Мария", actorEmail: "m@example.com", actorRole: "MANAGER",
  action: "UPDATE" as AuditAction, entityType: "task", entityId: "t1", clientId: null, projectId: null, campaignId: null, leadId: null,
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
    ["Set project KPIs", "project", { subject: "KPI проекта", name: null, detail: null }],
    ["Cleared project KPIs", "project", { subject: "KPI проекта", name: null, detail: "сброшен" }],
    ["Cleared organization KPI", "organization", { subject: "KPI организации", name: null, detail: "сброшен" }],
    ["Connected Meta advertising account", "project", { subject: "Рекламный аккаунт Meta", name: null, detail: "подключён" }],
    ["UPDATE lead column", "lead-column", { subject: "Колонка CRM", name: null, detail: null }],
    ["DELETE lead field", "lead-field", { subject: "Поле CRM", name: null, detail: null }],
    ["DELETE company", "crm-company", { subject: "Компания", name: null, detail: null }],
    ["DELETE person", "crm-person", { subject: "Контакт", name: null, detail: null }],
    ["Reset the second factor of Борис", "member", { subject: "Сотрудник", name: "Борис", detail: "сброшен второй фактор" }],
    ["Removed Борис from the organization", "member", { subject: "Сотрудник", name: "Борис", detail: "удалён из организации" }],
    ["Revoked the invitation for anna@example.com", "invite", { subject: "Приглашение", name: "anna@example.com", detail: "отозвано" }],
    ["Revoked an invitation", "invite", { subject: "Приглашение", name: null, detail: "отозвано" }],
    ["Deleted a comment on task “Подготовить отчёт”", "task-comment", { subject: "Комментарий к задаче", name: "Подготовить отчёт", detail: null }],
    ["Added a comment to task “Подготовить отчёт”", "task-comment", { subject: "Комментарий к задаче", name: "Подготовить отчёт", detail: null }],
    ["Removed an image from task “Макет”", "task-image", { subject: "Изображение задачи", name: "Макет", detail: null }],
    ["Removed document “Бриф.pdf” from task “Макет”", "task-document", { subject: "Документ задачи", name: "Макет", detail: "удалён документ «Бриф.pdf»" }],
    ["Edited a note on lead “Анна”", "lead-note", { subject: "Заметка лида", name: "Анна", detail: null }],
    ["Created a share link for project “Евроопт”", "project", { subject: "Проект", name: "Евроопт", detail: "ссылка создана" }],
    ["Replaced the share link of project “Евроопт”", "project", { subject: "Проект", name: "Евроопт", detail: "ссылка заменена" }],
    ["Switched off the share link of project “Евроопт”", "project", { subject: "Проект", name: "Евроопт", detail: "ссылка отключена" }],
    ["Connected Google Ads account", "project", { subject: "Рекламный аккаунт Google", name: null, detail: "подключён" }],
    ["Renewed Google Ads sign-in", "project", { subject: "Рекламный аккаунт Google", name: null, detail: "вход обновлён" }],
    ["Disconnected Google Ads account", "project", { subject: "Рекламный аккаунт Google", name: null, detail: "отключён" }],
    ["Replaced Meta advertising account credentials", "project", { subject: "Рекламный аккаунт Meta", name: null, detail: "данные для входа заменены" }],
    ["Connected Search Console site example.com", "project", { subject: "Сайт Search Console", name: "example.com", detail: "подключён" }],
    ["Renewed Search Console sign-in for example.com", "project", { subject: "Сайт Search Console", name: "example.com", detail: "вход обновлён" }],
    ["Disconnected Search Console site example.com", "project", { subject: "Сайт Search Console", name: "example.com", detail: "отключён" }],
    ["Linked Google Analytics property Основной to example.com", "project", { subject: "Google Analytics", name: "Основной", detail: "привязан к сайту «example.com»" }],
    ["Unlinked Google Analytics from example.com", "project", { subject: "Google Analytics", name: null, detail: "отвязан от сайта «example.com»" }],
    ["Created a website key for project “Евроопт”", "project", { subject: "Проект", name: "Евроопт", detail: "ключ сайта создан" }],
    ["Replaced the website key of project “Евроопт”", "project", { subject: "Проект", name: "Евроопт", detail: "ключ сайта заменён" }],
    ["Removed the website key of project “Евроопт”", "project", { subject: "Проект", name: "Евроопт", detail: "ключ сайта удалён" }],
    ["Changed the sites allowed to send leads to project “Евроопт”", "project", { subject: "Проект", name: "Евроопт", detail: "изменены сайты для заявок" }],
    ["Edited the 2026-09 report", "report", { subject: "Отчёт", name: "сентябрь 2026", detail: "изменён" }],
    ["Refreshed the 2026-09 report", "report", { subject: "Отчёт", name: "сентябрь 2026", detail: "обновлён" }],
    ["Entered past months for the 2026-09 report", "report", { subject: "Отчёт", name: "сентябрь 2026", detail: "введены прошлые месяцы" }],
    ["Changed the summary of project “Евроопт” for META account act_1", "project", { subject: "Проект", name: "Евроопт", detail: "плитки сводки" }],
    ["Created cabinet access for client “Клиника”", "client", { subject: "Клиент", name: "Клиника", detail: "создан доступ в кабинет" }],
    ["Issued a new cabinet password for client “Клиника”", "client", { subject: "Клиент", name: "Клиника", detail: "выдан новый пароль кабинета" }],
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

  it("names a deleted CRM record from the copy kept in the event", () => {
    expect(read("DELETE lead", { entityType: "lead", action: "DELETE", changes: { before: { name: "Иван" } } as never })?.name)
      .toBe("Иван");
    expect(read("DELETE company", { entityType: "crm-company", action: "DELETE", changes: { before: { name: "Лода" } } as never })?.name)
      .toBe("Лода");
  });

  it("names the documents and images a task took in its event", () => {
    expect(read("Updated task “Отчёт”", { changes: { documentsAdded: [{ id: "d", name: "Бриф.pdf" }] } as never })?.detail)
      .toBe("добавлен документ «Бриф.pdf»");
    expect(read("Created task “Отчёт”", {
      changes: { documentsAdded: [{ id: "a", name: "А.pdf" }, { id: "b", name: "Б.pdf" }], imagesAdded: ["i"] } as never,
    })?.detail).toBe("добавлены документы «А.pdf», «Б.pdf», добавлено изображение");
    expect(read("Updated task “Отчёт”", { changes: null })?.detail).toBeNull();
  });

  it("leaves a summary it does not know to be shown as it is", () => {
    expect(read("Изменён день 31 августа", { entityType: "campaignRecord" })).toBeNull();
  });
});

describe("reading an audit event in English", () => {
  afterEach(() => {
    localStorage.removeItem("adpulse.language");
    vi.resetModules();
  });

  it("reads a switched-off share link in English", async () => {
    localStorage.setItem("adpulse.language", "en");
    vi.resetModules();
    const { describeAuditEvent: describeEnglish } = await import("@/entities/audit-event/index.js");

    expect(describeEnglish(event("Switched off the share link of project “Евроопт”", { entityType: "project" })))
      .toEqual({ subject: "Project", name: "Евроопт", detail: "link switched off" });
  });
});
