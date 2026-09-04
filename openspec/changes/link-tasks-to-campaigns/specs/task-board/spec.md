## Purpose

A task is a unit of work under a project. Most of that work is about one campaign; some
of it is about the project as a whole. The board has to say which, without forcing a
campaign onto work that has none.

## ADDED Requirements

### Requirement: A task may name one campaign of its project

A task SHALL optionally name a campaign. The named campaign SHALL belong to the task's
own project; naming a campaign under any other project SHALL be refused. A task with no
campaign is about the project as a whole, and the interface SHALL present that as
**Общий** rather than as an empty or missing value.

No campaign SHALL be the default: a task created without naming one is stored with none.

#### Scenario: Creating a task on a campaign

- **WHEN** a member creates a task naming a campaign of the same project
- **THEN** the task is stored against that campaign and reads back with it

#### Scenario: Creating a task about the project as a whole

- **WHEN** a member creates a task naming no campaign
- **THEN** the task is stored with no campaign, and the board shows it as Общий

#### Scenario: Naming a campaign from another project

- **WHEN** a member creates or updates a task naming a campaign that belongs to a
  different project
- **THEN** the API responds 400 and the task's campaign is unchanged

#### Scenario: Naming a campaign that does not exist

- **WHEN** a member names a campaign id no campaign has, or one they cannot reach
- **THEN** the API responds 400, the same answer a campaign under another project gets,
  so an unreachable campaign is not distinguishable from an absent one

#### Scenario: Releasing a campaign

- **WHEN** a member updates a task naming no campaign where one was set
- **THEN** the task is stored with no campaign and becomes Общий

### Requirement: Moving a task to another project releases its campaign

Changing a task's project SHALL leave the task without a campaign, unless the same
request names a campaign of the new project. A task SHALL never be stored against a
campaign outside its own project, whatever order the two fields are changed in.

#### Scenario: Changing the project alone

- **WHEN** a member moves a task with a campaign to another project, naming no campaign
- **THEN** the task is stored under the new project with no campaign

#### Scenario: Changing the project and the campaign together

- **WHEN** a member moves a task to another project and names a campaign of that project
  in the same request
- **THEN** the task is stored under the new project against the named campaign

#### Scenario: Changing the project and naming the old campaign

- **WHEN** a member moves a task to another project while naming a campaign of the old one
- **THEN** the API responds 400 and neither the project nor the campaign changes

### Requirement: Deleting a campaign leaves its tasks standing

Deleting a campaign SHALL NOT delete the tasks that named it. Each such task SHALL be
left with no campaign, becoming a task about the project as a whole. Work outlives the
campaign it was about.

#### Scenario: A campaign with outstanding work is deleted

- **WHEN** a campaign named by two tasks is deleted
- **THEN** both tasks still exist, still under their project, each with no campaign
