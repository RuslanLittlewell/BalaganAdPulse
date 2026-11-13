## Purpose

Record how leads move through a project's CRM board and let a media buyer name the steps that
matter, such as qualified lead, measurement and sale, as conversion events built from board stages.

## ADDED Requirements

### Requirement: Stage changes of a lead are recorded

The system SHALL record each time a lead enters a stage of its project's board: when it is created
manually, when it is imported from Meta, when a member moves it to another stage, and when deleting
a column moves it to «Новый». Each record SHALL hold the lead, the stage it left (none at creation),
the stage it entered and the time. Reordering a lead within its stage SHALL NOT be recorded. Records
SHALL be kept when the lead is edited and SHALL be removed with the lead. Stage changes recorded in
the audit log before this capability was released SHALL be copied into the record: the creation of
each lead in its first stage, at the time the lead was created, and each move between stages, at
the time it was made. A lead with no creation entry in the audit log SHALL be recorded as entering
«Новый» when it was created.

#### Scenario: A moved lead
- **WHEN** a member moves a lead from «Новый» to «Квалифицированный» at 14:05
- **THEN** a stage change from «Новый» to «Квалифицированный» at 14:05 is recorded for the lead

#### Scenario: Reordering within a stage
- **WHEN** a member drags a lead to another position in the same column
- **THEN** no stage change is recorded

#### Scenario: An imported lead
- **WHEN** a lead is imported from a Meta lead form
- **THEN** its entry into «Новый» is recorded at the time of import

#### Scenario: A deleted column
- **WHEN** a member deletes a custom column that holds two leads
- **THEN** each of the two leads has a stage change into «Новый» recorded

#### Scenario: History before the release
- **WHEN** the release is installed on a board where a lead was moved to «КП» a month earlier
- **THEN** that move appears in the lead's stage history at its original time

### Requirement: A project defines conversion events

A member whose role may manage integrations SHALL be able to create, rename, edit and delete the
conversion events of a reachable project. An event SHALL have a name of 1 to 50 characters that no
other event of the project has, ignoring case; one or more stages of the project's board, fixed or
custom, where one stage may belong to several events; and a choice of whether the event carries
the lead's amount. A project SHALL hold at most 10 events. Events SHALL be listed in the order they
were created. Members who may not manage integrations SHALL NOT read or change events and SHALL
receive 403; an unknown or unreachable project SHALL return 404. Creating, editing and deleting an
event SHALL be recorded in the audit log.

#### Scenario: Creating a sale event
- **WHEN** a manager creates the event «Продажа» with the stage «Оплачено» and the amount option on
- **THEN** the project lists «Продажа» with that stage, carrying the amount

#### Scenario: One stage in two events
- **WHEN** a manager adds the stage «Оплачено» to the event «Квал» as well
- **THEN** both «Квал» and «Продажа» list «Оплачено»

#### Scenario: A duplicate name
- **WHEN** a manager creates an event named «квал» while «Квал» exists
- **THEN** the request is refused with 409 and nothing changes

#### Scenario: No stages
- **WHEN** a manager saves an event with no stages
- **THEN** the request is refused with a validation error

#### Scenario: A stage of another board
- **WHEN** a manager saves an event with a column of another project's board
- **THEN** the request is refused with a validation error

#### Scenario: The eleventh event
- **WHEN** a manager creates an event in a project that already has 10
- **THEN** the request is refused with a validation error

#### Scenario: A client
- **WHEN** a client who may edit the project's board requests its conversion events
- **THEN** the server responds 403

### Requirement: A lead reaches an event once

A lead SHALL reach an event at the first time in its stage history that it entered one of the
event's stages. Leaving the event's stages and entering them again SHALL NOT make the lead reach the
event again. A lead that enters a stage belonging to several events SHALL reach each of those it had
not reached before. Which stages belong to an event SHALL be read as they are now, so adding a
stage to an event changes which past entries count.

#### Scenario: Back and forth
- **WHEN** a lead enters «Квалифицированный» on Monday, returns to «Новый» on Tuesday and enters
  «Квалифицированный» again on Wednesday, and «Квал» holds that stage
- **THEN** the lead reached «Квал» on Monday, once

#### Scenario: Skipping a stage
- **WHEN** «Квал» holds «Квалифицированный» and «Оплачено», «Продажа» holds «Оплачено», and a lead
  moves from «Новый» straight to «Оплачено»
- **THEN** the lead reaches both «Квал» and «Продажа» at the time of that move

#### Scenario: A stage added later
- **WHEN** a lead entered «Целевой» last week and a manager now adds «Целевой» to «Квал»
- **THEN** the lead reached «Квал» last week

### Requirement: A deleted column leaves its events

Deleting a custom column SHALL remove it from the stages of every event of the project. An event
left without stages SHALL be kept, SHALL be reached by no lead until a stage is added, and SHALL be
shown as having no stages.

#### Scenario: The only stage is deleted
- **WHEN** a manager deletes the column «Замер назначен», the only stage of «Замер»
- **THEN** «Замер» remains in the list, marked as having no stages, and no lead reaches it
