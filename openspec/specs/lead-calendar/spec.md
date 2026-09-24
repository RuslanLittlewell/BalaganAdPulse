# lead-calendar Specification

## Purpose
A second view of a CRM board's leads, arranged by the day they arrived rather than by the
stage they have reached, so a member can see what a week brought in. Unlike the tasks
calendar this view does not schedule anything: a lead's day is a fact about the past, so the
view is read-only navigation, not a place to drag work around.

## Requirements

### Requirement: CRM offers a board and a calendar

The CRM screen SHALL offer two views of the selected board's leads — `Канбан` and
`Календарь` — chosen from a tab list next to the board selector. Exactly one SHALL be shown
at a time. The tabs SHALL be reachable and switchable from the keyboard, and each SHALL
expose whether it is the selected one.

The chosen view SHALL be remembered for that person in that browser and SHALL be the view
they return to, independently of which board is selected. A person who has never chosen
SHALL see the board.

#### Scenario: Switching to the calendar
- **WHEN** a member selects `Календарь`
- **THEN** the board is replaced by the calendar for the currently selected board, and the
  calendar is marked as the selected tab

#### Scenario: The choice outlives the session
- **WHEN** a member who last used the calendar reloads the CRM screen
- **THEN** the calendar is shown

#### Scenario: A first visit
- **WHEN** a member opens CRM having never chosen a view
- **THEN** the board is shown

#### Scenario: Another person on the same browser
- **WHEN** a different person signs in on the same browser
- **THEN** their own remembered view is used, and the board if they have none

#### Scenario: Switching boards keeps the view
- **WHEN** a member on the calendar switches from client A's board to client B's
- **THEN** the calendar stays shown, now for client B's leads

### Requirement: The calendar shows one week at a time

The calendar SHALL show seven day columns, Monday to Sunday, of a single week. It SHALL name
the week being shown and mark today's column when today falls in it. It SHALL offer moving to
the previous week, to the next week, and back to the week that holds today, with no limit on
how far a member may travel in either direction.

The calendar SHALL open on the week that holds today.

#### Scenario: Opening the calendar
- **WHEN** a member opens the calendar on Thursday 17 September
- **THEN** the week of Monday 14 to Sunday 20 September is shown, with Thursday marked as
  today

#### Scenario: Travelling to the next week
- **WHEN** a member moves to the next week
- **THEN** the seven days of that week are shown, no day is marked as today, and the week is
  named

#### Scenario: Coming back to today
- **WHEN** a member three weeks ahead chooses to return to the current week
- **THEN** the week holding today is shown again

### Requirement: A lead is shown on the day it arrived

The calendar SHALL place each lead of the selected board on the single day it arrived: an
imported lead on the UTC calendar day of its form submission, any other lead on the UTC
calendar day it was created — the same arrival the CRM's period lead counts already use.
Every lead SHALL have exactly one such day, so every lead of the board appears somewhere in
whatever week holds its arrival day. A day with no leads SHALL still be drawn, empty, in its
place in the week. Within a day, leads SHALL be shown earliest-arrival-first.

A lead's card SHALL show what its board card shows: name, supplied company and contact
details, and acquisition source.

#### Scenario: A hand-made lead's day
- **WHEN** a member creates a lead by hand on Wednesday
- **THEN** it is shown in Wednesday's column of the week holding that Wednesday

#### Scenario: An imported lead's day
- **WHEN** a lead is imported from a form submitted on Monday and the import runs on Tuesday
- **THEN** it is shown in Monday's column, not Tuesday's

#### Scenario: Order within a day
- **WHEN** a day holds a lead that arrived at 09:00 and a lead that arrived at 15:00
- **THEN** they are shown in that day in that order, 09:00 first

#### Scenario: An empty day
- **WHEN** no lead arrived on Sunday of the week being shown
- **THEN** Sunday's column is drawn, empty, after Saturday

### Requirement: The calendar does not move leads

A lead card in the calendar SHALL open the same detail dialog a click opens on the board, with
the same permissions. It SHALL NOT be draggable, and no day column SHALL accept a dropped
card: a lead's arrival day is fixed history, not a schedule this view sets.

#### Scenario: Opening a card
- **WHEN** a member clicks a lead card in the calendar
- **THEN** the same dialog the board would open for that lead is shown

#### Scenario: No drag affordance
- **WHEN** a member who may edit leads opens the calendar
- **THEN** no lead card offers a drag handle and no day column highlights as a drop target

### Requirement: The calendar follows the selected board

The calendar SHALL show exactly the leads of the board selected in the CRM header, by the
same reach rules as the board, and SHALL reflect a change made elsewhere — by another member,
or by the member themselves on the board — without a manual reload. Switching to another
board while the calendar is shown SHALL replace its leads with that board's own and clear the
previous board's cards immediately.

#### Scenario: Reach is the same
- **WHEN** a member reaches only project A's board and project B's board
- **THEN** the calendar, like the board selector, offers only those two boards' leads

#### Scenario: A change made by someone else
- **WHEN** another member imports a lead onto the board the calendar is showing
- **THEN** the new lead appears in its arrival day's column without the member reloading

#### Scenario: Switching boards during the calendar view
- **WHEN** a member switches from project A's board to project B's while the calendar is open
- **THEN** the calendar shows project B's leads and none of project A's remain
