## Purpose

The history window opened from the app header: what happened in the organization, read by
project or by person.

## ADDED Requirements

### Requirement: The history window reads by project or by person

The history window SHALL offer two tabs, **Проекты** and **Сотрудники**, opening on
**Проекты**. **Проекты** SHALL list the events tied to a project, newest first, with a select
holding **Все проекты** and every project the viewer reaches; choosing a project SHALL list
that project's events only. **Сотрудники** SHALL list every event the viewer may read, newest
first, with a select holding **Все сотрудники** and every person who appears in those events;
choosing a person SHALL list that person's events only. Each tab SHALL keep its own choice
while the window is open, and SHALL load further events on demand.

#### Scenario: One project
- **WHEN** an admin chooses Евроопт on **Проекты**
- **THEN** only Евроопт's events are listed

#### Scenario: One person
- **WHEN** an admin chooses Борис on **Сотрудники**
- **THEN** only Борис's actions are listed, his coming online and going offline among them

#### Scenario: Switching back
- **WHEN** an admin chooses Борис on **Сотрудники**, switches to **Проекты** and back
- **THEN** **Сотрудники** still shows Борис

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
