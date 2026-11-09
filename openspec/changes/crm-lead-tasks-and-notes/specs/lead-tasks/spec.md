## Purpose

Let a member plan work against a lead: create tasks that belong to one lead, see them in the lead's panel, and see all of them together in a CRM view of the task manager.

## ADDED Requirements

### Requirement: A task may belong to a lead

A task SHALL belong to at most one lead. A task that belongs to a lead SHALL belong to the project of that lead, and the API SHALL set the project from the lead. A request that names a lead together with a different project SHALL be refused with 400. A task SHALL keep its lead for its whole life: a request that changes or clears the lead of an existing task SHALL be refused with 400, and a request that moves such a task to another project SHALL be refused with 400. A task of a lead SHALL NOT be shared with the client. A lead that the member cannot reach SHALL answer 404. Deleting a lead SHALL delete its tasks.

#### Scenario: Creating a task for a lead
- **WHEN** a manager who reaches a lead creates a task that names it
- **THEN** the task is stored with that lead and with the lead's project

#### Scenario: A lead and another project
- **WHEN** a request names a lead and a project other than the lead's
- **THEN** the API responds 400 and no task is stored

#### Scenario: Detaching a task from its lead
- **WHEN** a request sets the lead of a task to none
- **THEN** the API responds 400 and the task is unchanged

#### Scenario: A lead the member cannot reach
- **WHEN** a manager names a lead of a client they hold no grant for
- **THEN** the API responds 404

#### Scenario: Deleting a lead
- **WHEN** a member deletes a lead that has two tasks
- **THEN** both tasks are deleted with it

### Requirement: Tasks of leads stay out of the task manager's other views

The task list SHALL leave out tasks that belong to a lead unless the request asks for the tasks of leads. The board, the calendar and the calls view of the task manager, the due-task counts on the dashboard, and every project's task list SHALL show no task of a lead. A task of a lead SHALL follow the same access rules as other tasks of its project, and the same role rules for creating, changing, moving, completing and deleting.

#### Scenario: The board after a lead task is created
- **WHEN** a manager creates a task for a lead
- **THEN** the board and the calendar do not show it

### Requirement: The task manager has a CRM view

The task manager SHALL offer the view CRM beside Доска, Календарь and Звонки. The view SHALL show every task that belongs to a lead and that the member reaches in the same week calendar as Календарь, with the lead's name on each task where the project's name stands on others. Choosing a task SHALL open the same task dialog the other views open. Choosing the lead's name SHALL open the lead's board with the lead's panel open. The create button in this view SHALL ask for a lead before anything else, and SHALL NOT create a task without one. The view SHALL show the existing people and project filters of the task manager. A member who may not create tasks SHALL be offered no create button. The chosen view SHALL be remembered like the other views.

#### Scenario: Opening the CRM view
- **WHEN** a manager chooses CRM
- **THEN** the tasks of leads are listed with their lead names, and tasks without a lead are absent

#### Scenario: Creating a task in the CRM view
- **WHEN** a manager presses the create button in CRM, picks a lead and fills in the title
- **THEN** the task is stored for that lead and appears in the list

#### Scenario: Creating without a lead
- **WHEN** a manager presses create in CRM and leaves the lead empty
- **THEN** the form refuses to save and names the missing lead

#### Scenario: Going to the lead
- **WHEN** a member chooses the lead name on a task
- **THEN** the CRM board of that lead's project opens with the lead's panel open

### Requirement: The lead panel lists and creates the lead's tasks

The Задачи tab of the lead panel SHALL list the lead's tasks, as blocks, with the open ones first, ordered by due date, then the done ones. A member who may create tasks SHALL be offered a create button, and the task it creates SHALL belong to the open lead without asking for one. Choosing a task SHALL open the task dialog. A task created or changed from the panel or from the CRM view SHALL appear in the other without a reload. The tab SHALL show how many tasks of the lead are open. A lead without tasks SHALL show a quiet empty message.

#### Scenario: Creating from the panel
- **WHEN** a manager presses the create button in the Задачи tab of lead Анна and saves a task titled Перезвонить
- **THEN** Перезвонить appears in the tab and, in the CRM view, with Анна as its lead

#### Scenario: Completing a task
- **WHEN** a manager completes a task in the tab
- **THEN** the task moves below the open ones and the open count drops by one

#### Scenario: A guest
- **WHEN** a guest opens the Задачи tab
- **THEN** the tasks are listed and no create button is shown

### Requirement: The CRM page has a Задачи layout

The Задачи layout of the CRM page SHALL list the tasks of the selected board's leads, as the same week calendar as the CRM view of the task manager, bounded to that one board. The view bar's search and filters SHALL apply to the lead of each task. A member SHALL be able to open a task in the task dialog, complete it, and, when they may create tasks, create one: the create button SHALL ask for a lead among the leads of the selected board and SHALL NOT create a task without one. Choosing a task's lead name SHALL open the lead's panel beside the list. A change made here SHALL appear in the CRM view of the task manager, and the reverse.

#### Scenario: Tasks of one board
- **WHEN** a member opens Задачи on the board of project Сайт
- **THEN** only tasks of Сайт's leads are listed

#### Scenario: Searching by lead
- **WHEN** a member types Анна in the search field on Задачи
- **THEN** only tasks of leads that match Анна stay listed

#### Scenario: Creating from the layout
- **WHEN** a manager presses create on Задачи, picks a lead of the board and saves a task
- **THEN** the task is listed here and in the CRM view of the task manager

#### Scenario: Opening the lead
- **WHEN** a member chooses a lead name on a task
- **THEN** the lead's panel opens beside the list

### Requirement: A task of a lead always has a day

A task of a lead SHALL have a due day. The API SHALL refuse with 400 a task created for a lead without a day, and a change that clears the day of such a task. The task form opened for a lead, from the lead's panel or from a CRM layout, SHALL start with today as the day, SHALL keep the dates block shown, and SHALL NOT offer removing the day. The day MAY be moved to another day.

#### Scenario: A new task starts today
- **WHEN** a manager opens the create form from a lead's Задачи tab
- **THEN** the due day reads today and the task is saved with it unless the manager picks another day

#### Scenario: Creating without a day through the API
- **WHEN** a request creates a task for a lead with no due day
- **THEN** the API responds 400 and no task is stored

#### Scenario: Clearing the day
- **WHEN** a request clears the due day of a task of a lead
- **THEN** the API responds 400 and the task keeps its day

#### Scenario: Moving the day
- **WHEN** a manager drags a task of a lead to another day on the calendar
- **THEN** the task takes that day
