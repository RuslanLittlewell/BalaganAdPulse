# activity-log Specification

## Purpose
The history window opened from the app header: what happened in the organization, read by
project or by person.

## Requirements

### Requirement: The history window reads by project or by person

The history window SHALL offer four tabs, **Проекты**, **Задачи**, **CRM** and **Сотрудники**, opening on **Проекты**. Each event SHALL appear on the tab of its type. **Задачи** SHALL list the events of tasks that belong to no lead, with their comments and files. **CRM** SHALL list the events of leads, lead columns, lead fields, companies and people, lead notes and lead files, and of tasks of leads with their comments and files. **Проекты** SHALL list the other events about the organization's work: clients, projects, campaigns, documents, reports, KPIs, summary tiles, integrations, share links and website keys. Removing a member, revoking an invitation, resetting a member's second factor, coming online and going offline SHALL appear on none of these three tabs.

**Проекты**, **Задачи** and **CRM** SHALL each list their events newest first, with a select holding **Все проекты** and every project the viewer reaches. Choosing a project SHALL list that project's events of the tab's type only. **Все проекты** SHALL list every event of the tab's type, those that belong to no project included. **Сотрудники** SHALL list every event the viewer may read, newest first, with a select holding **Все сотрудники** and every person who appears in those events; choosing a person SHALL list that person's events only. Each tab SHALL keep its own choice while the window is open, and SHALL load further events on demand.

#### Scenario: One project
- **WHEN** an admin chooses Евроопт on **Проекты**
- **THEN** only Евроопт's events that belong on **Проекты** are listed, and none of its tasks or leads

#### Scenario: One person
- **WHEN** an admin chooses Борис on **Сотрудники**
- **THEN** only Борис's actions are listed, his coming online and going offline among them

#### Scenario: Switching back
- **WHEN** an admin chooses Борис on **Сотрудники**, switches to **Проекты** and back
- **THEN** **Сотрудники** still shows Борис

#### Scenario: Each type tab keeps its own project
- **WHEN** an admin chooses Евроопт on **Проекты**, opens **Задачи**, chooses Лода there and returns to **Проекты**
- **THEN** **Проекты** shows Евроопт, **Задачи** still shows Лода when opened again, and **CRM** shows **Все проекты**

#### Scenario: A task of a lead
- **WHEN** a manager creates a task for the lead Анна
- **THEN** the event is listed on **CRM** and not on **Задачи**

#### Scenario: A comment on a task without a lead
- **WHEN** a manager deletes a comment on a task that belongs to no lead
- **THEN** the event is listed on **Задачи**

#### Scenario: Events about people
- **WHEN** an admin removes a member from the organization
- **THEN** the event is listed on **Сотрудники** and on none of **Проекты**, **Задачи** and **CRM**

#### Scenario: An event without a project
- **WHEN** a member deletes the company Лода and an admin opens **CRM**
- **THEN** the deletion is listed under **Все проекты** and is not listed once a project is chosen

#### Scenario: A deleted client
- **WHEN** an admin deletes a client and opens **Проекты** with **Все проекты**
- **THEN** the client's deletion is listed

### Requirement: Events read as a timeline by day

The list SHALL group events by day under **Сегодня**, **Вчера** or the date, the year added
when it is not the current one, as a timeline whose marker and action label take the action's
colour: creating, changing, deleting, coming online and going offline each their own. Each
event SHALL show its time of day and SHALL give how long ago it happened on hover.

A change SHALL read in Russian as what it concerns and its name — «Задача «Подготовить
отчёт»», «Отчёт «сентябрь 2026» · опубликован», «Задача «123» · Идея → В работе» — read from
the summary the API recorded, with the action label, the actor and the project beneath, and the
changed values when there are any. A summary the window cannot read SHALL be shown as it is.
Coming online and going offline SHALL show as the person with **Онлайн** or **Офлайн**,
without a summary.

#### Scenario: Going offline
- **WHEN** Борис went offline at 18:05 on 20 October and it is 22 October
- **THEN** under «20 октября» his row reads Борис, **Офлайн**, 18:05

#### Scenario: A task created today
- **WHEN** Борис created the task «Подготовить отчёт» on Лода today at 10:00
- **THEN** under «Сегодня» it reads «Задача «Подготовить отчёт»», 10:00, with **Создание**, Борис and Лода beneath

#### Scenario: An unknown summary
- **WHEN** an event's summary matches none the window knows
- **THEN** the summary is shown as it was recorded

### Requirement: A deletion shows what went with it

Under the event of a deleted client, project, lead or task, the window SHALL show what the database removed with the record, as counts by kind in the interface language, leaving out kinds with none, for example «Вместе с проектом удалено: 12 задач, 30 лидов». An event that carries no counts SHALL show no such line.

#### Scenario: A project with tasks and leads
- **WHEN** an admin deleted a project that held 12 tasks, 30 leads and nothing else
- **THEN** the deletion's row shows «Вместе с проектом удалено: 12 задач, 30 лидов»

#### Scenario: A lead with a task and notes
- **WHEN** a manager deleted a lead that had one task and two notes
- **THEN** the deletion's row shows «Вместе с лидом удалено: 1 задача, 2 заметки»

#### Scenario: Nothing went with it
- **WHEN** a manager deleted a task without comments or files
- **THEN** the deletion's row shows no such line

### Requirement: Every recorded event reads in the interface language

Every summary the API records SHALL have a reading in Russian and in English that names what the event concerns, its name and the detail, the way the existing readings do. This SHALL cover creating, replacing and switching off a project's share link; connecting a Google Ads account, renewing its sign-in and disconnecting it; replacing Meta credentials; connecting, renewing and disconnecting a Search Console site; linking and unlinking Google Analytics; creating, replacing and removing the website key and changing the sites allowed to send leads; editing a report, refreshing it and entering its past months; changing a project's summary tiles for one account; resetting a member's second factor; writing, editing and deleting a task comment; attaching files to a task and removing a task image or document; writing, editing and deleting a lead note; removing a member; and revoking an invitation. A summary the window does not know SHALL still be shown as it was recorded.

#### Scenario: A share link switched off
- **WHEN** a manager switched off the share link of the project Евроопт
- **THEN** the row reads «Проект «Евроопт» · ссылка отключена» and no English text

#### Scenario: A Search Console site disconnected
- **WHEN** a manager disconnected the Search Console site example.com
- **THEN** the row reads «Сайт Search Console «example.com» · отключён»

#### Scenario: Summary tiles of one account
- **WHEN** a manager changed the summary of Евроопт for one Meta account
- **THEN** the row reads «Проект «Евроопт» · плитки сводки» and no English text

#### Scenario: A deleted comment
- **WHEN** Борис deleted a comment on the task «Подготовить отчёт»
- **THEN** the row reads «Комментарий к задаче «Подготовить отчёт»», with **Удаление** and Борис beneath

#### Scenario: An attached document
- **WHEN** a manager saved the task «Подготовить отчёт» with the new document Бриф.pdf
- **THEN** the row reads «Задача «Подготовить отчёт» · добавлен документ «Бриф.pdf»»

#### Scenario: A removed member
- **WHEN** an admin removed Борис from the organization
- **THEN** the row on **Сотрудники** reads «Сотрудник «Борис» · удалён из организации», with **Удаление**

#### Scenario: A revoked invitation
- **WHEN** an admin revoked the invitation for anna@example.com
- **THEN** the row on **Сотрудники** reads «Приглашение «anna@example.com» · отозвано», with **Удаление**

#### Scenario: The English interface
- **WHEN** the interface language is English and a manager switched off the share link of Евроопт
- **THEN** the row reads «Project «Евроопт» · link switched off»
