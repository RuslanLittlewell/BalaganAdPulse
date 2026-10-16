## ADDED Requirements

### Requirement: A project's campaign table shows running campaigns first or alone

A project's campaign table SHALL offer a «Только активные» switch, which SHALL be on
whenever a project is opened and SHALL NOT be remembered between projects or visits.
A campaign SHALL count as running when it is active or learning, as its indicator
counts it.

While the switch is on, the table SHALL list only running campaigns. While it is off, the
table SHALL list every campaign, running ones above the rest. In either case campaigns
SHALL keep their existing order among themselves. The switch SHALL narrow the campaigns
of the chosen advertising account when they are split by account.

The table's total row SHALL total the campaigns the table lists: their measured figures
summed, and every ratio derived from those sums as a project's total derives it. A
project with campaigns of which none is running SHALL, with the switch on, say that no
campaign is running rather than that the project has none.

#### Scenario: Opening a project

- **WHEN** a member opens a project whose campaigns are partly running
- **THEN** the switch is on and the table lists only the running campaigns, in their
  existing order, with a total row of those campaigns

#### Scenario: Turning the switch off

- **WHEN** a member turns the switch off
- **THEN** every campaign is listed, running ones first, and the total row totals them all

#### Scenario: Opening another project

- **WHEN** a member who turned the switch off opens another project
- **THEN** the switch is on again

#### Scenario: A learning campaign

- **WHEN** a campaign is learning
- **THEN** it is listed with the switch on

#### Scenario: Nothing running

- **WHEN** a project's campaigns are all paused or ended and the switch is on
- **THEN** the table says no campaign is running

#### Scenario: A total of the listed campaigns

- **WHEN** the table lists campaigns that spent 200 and 800 with revenue of 1000 each
- **THEN** the total row shows a spend of 1000 and a ROAS of 2, not the average of the
  campaigns' ROAS
