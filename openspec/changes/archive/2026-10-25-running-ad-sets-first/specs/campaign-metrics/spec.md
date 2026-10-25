## ADDED Requirements

### Requirement: A campaign's ad set table shows running ad sets first or alone

The campaign page SHALL offer a «Только активные» switch above its ad set table, which SHALL be on
whenever a campaign is opened and SHALL NOT be remembered between campaigns or visits. An ad set or
an ad SHALL count as running when it is active or learning.

While the switch is on, the table SHALL list only running ad sets and, under an expanded ad set,
only its running ads. While it is off, the table SHALL list every ad set and ad, running ones above
the rest. In either case they SHALL keep their existing order among themselves. A campaign with ad
sets of which none is running SHALL, with the switch on, say that no ad set is running rather than
that the campaign has none.

#### Scenario: Opening a campaign
- **WHEN** a member opens a campaign whose ad sets are partly paused
- **THEN** the switch is on and only the running ad sets are listed

#### Scenario: Running ads only
- **WHEN** the member expands a running ad set holding a running and a paused ad
- **THEN** only the running ad is listed under it

#### Scenario: Turning the switch off
- **WHEN** the member turns the switch off
- **THEN** every ad set and ad is listed, running ones first

#### Scenario: Nothing running
- **WHEN** every ad set of a campaign is paused and the switch is on
- **THEN** the table says no ad set is running

#### Scenario: Another campaign
- **WHEN** a member who turned the switch off opens another campaign
- **THEN** the switch is on again
