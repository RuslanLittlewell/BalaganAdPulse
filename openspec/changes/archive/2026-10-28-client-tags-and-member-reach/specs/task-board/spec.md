## MODIFIED Requirements

### Requirement: A client opens a task in the agency's form

A `CLIENT` or `CLIENT_ADMIN` opening a task SHALL see the same task form an admin sees — its
title, stage, priority, description, checklist, dates, project, attachments and comments —
without the Видно клиенту switch and without the participants, which a customer never names.

On a task on a project, which a customer may not change, every field SHALL be shown and none
SHALL be changeable: no control adds or removes a block, edits the description or removes an
attachment, and the form offers no save or delete, only a way to close it. Commenting SHALL stay
as it is.

On their own personal task the form SHALL be editable as it is for a manager, with a way to
delete the task. While a client chooses no project, the form SHALL say that a task without a
project is seen by them alone.

#### Scenario: A client opens a task on a project
- **WHEN** a client opens a task the agency shared with them
- **THEN** the form shows its title, stage and priority, none can be changed, there is no
  Видно клиенту switch, no Сохранить and no Удалить, and Закрыть closes it

#### Scenario: A client opens their personal task
- **WHEN** a client opens a personal task they raised, renames it and saves
- **THEN** the change is stored, and the form offered Удалить

#### Scenario: A client raises a task with no project
- **WHEN** a client opens the form to raise a task and chooses no project
- **THEN** the form says Задачу без проекта видите только вы

#### Scenario: Closing a personal task from its card
- **WHEN** a client ticks Готово on the card of their personal task
- **THEN** the task moves to `DONE`, while the cards of tasks on projects carry no Готово for them

#### Scenario: A choice in a task the client may not change
- **WHEN** a client presses the project or the repeat field of a task on a project
- **THEN** no list of choices opens and the task is unchanged
