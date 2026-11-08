## MODIFIED Requirements

### Requirement: Users fill the range from shortcuts

Every metrics view SHALL offer yesterday, last-7-days, current-month and previous-month shortcuts, in that order, before its date inputs. The yesterday shortcut SHALL produce a range that starts and ends on the day before today. A shortcut SHALL apply its inclusive range the same way a manual entry does and SHALL report itself as pressed only while the current range equals the range it produces.

#### Scenario: Apply a shortcut

- **WHEN** a user presses the last-7-days shortcut
- **THEN** both date inputs and every metrics request use the seven days ending today
- **AND** the address carries those two dates

#### Scenario: Yesterday

- **WHEN** a user presses Вчера on 13 October
- **THEN** both date inputs read 12 October and every metrics request covers that day alone

#### Scenario: Shortcut reflects the current range

- **WHEN** the current range equals the range a shortcut produces
- **THEN** that shortcut is presented as pressed and the others are not
