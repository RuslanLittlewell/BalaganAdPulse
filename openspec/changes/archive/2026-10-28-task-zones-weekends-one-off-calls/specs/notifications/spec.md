## MODIFIED Requirements

### Requirement: A member keeps their own notifications

Every notification SHALL belong to one member of one organization and SHALL be of one kind:
KPI_MET about a project, PROJECT_CREATED about a project and the member who added it,
TASK_ASSIGNED about a task and the member who named the recipient on it, TASK_UPDATED about a
task and the member who last changed it, DOCUMENT_ADDED about a project document and the member
who added it, or TASK_DUE_SOON about a task. It SHALL record when it was created and whether
and when its recipient read it. A member SHALL read only their own notifications:
`GET /api/notifications` SHALL return their latest 50, newest first, each with its kind,
creation time, read time or null, the project's id and name, the task's id, title, project id,
due date, due time and the time zone they are read in, the document's id and title, and the name of the member who caused it,
where the kind has them, together with the number of their unread notifications. A
notification SHALL be deleted with its recipient's membership, its project, its task or its
document; when the member who caused it is deleted, it SHALL remain without their name.

#### Scenario: Only one's own

- **WHEN** Анна and Борис each have notifications and Анна reads the list
- **THEN** the list holds only Анна's notifications, newest first, with Анна's unread count

#### Scenario: The latest fifty

- **WHEN** a member has 60 notifications, 55 of them unread
- **THEN** the list holds the latest 50 and the unread count is 55

#### Scenario: The task is deleted

- **WHEN** a task a member was notified of is deleted
- **THEN** that notification is no longer in their list

### Requirement: The bell shows and opens notifications

The app header SHALL show a bell, named Уведомления, to every signed-in member, as the first of
its icons, before Contacts and History. While any of their notifications is unread, the bell SHALL carry a dot and
tell assistive technology that there are unread notifications. Choosing the bell SHALL open a
list headed Уведомления of the latest notifications, newest first, each with its text, the name
of the member who caused it where there is one, and how long ago it happened, unread ones
marked; with none, the list SHALL say Уведомлений пока нет. The texts SHALL be:

- KPI_MET: Проект «name» выполнил KPI;
- PROJECT_CREATED: Новый проект «name»;
- TASK_ASSIGNED: Вас назначили участником задачи «title»;
- TASK_UPDATED: Задача «title» изменена;
- DOCUMENT_ADDED: Новый документ «title» в проекте «name»;
- TASK_DUE_SOON: Подходит срок задачи «title», with the deadline beside the time. The deadline's day and time
  SHALL be shown in the reader's own time zone.

Choosing a notification SHALL mark it read and open its document, its project, or the tasks page
with its task open. While any is unread, the list SHALL offer Прочитать все, which marks them all
read. A notification arriving on the stream SHALL appear at the top of the list and light the
dot without a reload. When the stream drops, the app SHALL reconnect and refresh the list.

A notification arriving on the stream, new or refreshed, SHALL play the notification sound once,
in one tab of the browser even when several are open, the visible tab first. When the browser
refuses to play sound, as it does before the member has interacted with the page, the
notification SHALL still appear and nothing SHALL fail. Notifications fetched with the list, on
opening the app or after a reconnection, SHALL NOT play it.

#### Scenario: A new notification lights the dot

- **WHEN** a notification arrives on the stream while the member looks at the dashboard
- **THEN** the bell carries a dot, and opening it shows the notification at the top, marked unread

#### Scenario: A sound for a new notification

- **WHEN** a notification arrives on the stream
- **THEN** the notification sound plays

#### Scenario: Several tabs

- **WHEN** the member has three tabs of the app open and a notification arrives
- **THEN** the sound plays once

#### Scenario: Sound refused

- **WHEN** a notification arrives before the member has clicked anywhere on the page and the
  browser refuses to play sound
- **THEN** the notification appears and lights the dot as usual

#### Scenario: Opening a task from a notification

- **WHEN** the member chooses Вас назначили участником задачи «Позвонить клиенту»
- **THEN** it is marked read and the tasks page opens with that task open

#### Scenario: Opening a project from a notification

- **WHEN** the member chooses Проект «Клиника» выполнил KPI
- **THEN** it is marked read and the project Клиника opens

#### Scenario: Opening a document from a notification

- **WHEN** the member chooses Новый документ «Медиаплан» в проекте «Клиника»
- **THEN** it is marked read and the document Медиаплан of Клиника opens

#### Scenario: A refreshed notification

- **WHEN** a TASK_UPDATED the member has not read is refreshed by a further change
- **THEN** it moves to the top of the list, naming the member who made the latest change, and the
  unread count stays the same

#### Scenario: Reading all

- **WHEN** the member chooses Прочитать все
- **THEN** no notification is marked unread and the bell carries no dot

#### Scenario: Nothing yet

- **WHEN** a member with no notifications opens the bell
- **THEN** the list says Уведомлений пока нет and offers no Прочитать все

#### Scenario: A deadline read in another time zone

- **WHEN** a member in Warsaw is notified of a task due 20 October at 18:00 in Minsk
- **THEN** the notification shows the deadline as 20 October, 17:00

### Requirement: A task's deadline drawing near is notified

A task's deadline SHALL be its due date at its due time, or at the end of its due date when it
has no time, read in the task's time zone, or in the agency's time zone, Europe/Minsk unless the
API is configured with another, for a task that carries none. Once the deadline is less than 24 hours away and has not passed, the task's
participants SHALL be notified with TASK_DUE_SOON, or the member who created it when it names
nobody. A task SHALL be notified once per deadline: changing its due date or time, or completing
a repeating task into its next occurrence, gives it a new deadline to be notified of. Tasks
without a due date, tasks in Готово or Архив, and tasks of organizations without the tasks
module SHALL NOT be notified. A client's person SHALL be notified only when the task is shown to
the client. The API SHALL look for such tasks at least every 15 minutes.

#### Scenario: A day before

- **WHEN** a task naming Борис is due on 20 October at 18:00 and it is 19 October, 18:10 in Minsk
- **THEN** Борис is notified that the task's deadline is near

#### Scenario: Not yet

- **WHEN** it is 19 October, 17:50 in Minsk
- **THEN** nobody is notified of that task

#### Scenario: A due date without a time

- **WHEN** a task is due on 20 October with no time and it is 20 October, 00:10 in Minsk
- **THEN** its participants are notified

#### Scenario: Once per deadline

- **WHEN** the task has been notified and the API looks again an hour later
- **THEN** nobody is notified again

#### Scenario: A new deadline

- **WHEN** the task is moved to 22 October at 18:00 and it becomes 21 October, 18:10
- **THEN** its participants are notified again

#### Scenario: Nobody named

- **WHEN** a task Анна created names nobody and its deadline draws near
- **THEN** Анна is notified

#### Scenario: Done

- **WHEN** a task in Готово has a deadline within the day
- **THEN** nobody is notified

#### Scenario: A task set in Warsaw

- **WHEN** a task naming Борис is due on 20 October at 18:00 in Warsaw and it is 19 October, 18:10
  in Minsk
- **THEN** nobody is notified yet, and Борис is notified once it is 19 October, 19:10 in Minsk
