# segmented-control Specification

## Purpose
A draggable rubber-thumb segmented control used everywhere the app previously
rendered a tab switcher, including inside modals, so a member always has one
consistent single-select control regardless of where it appears.

## Requirements

### Requirement: Choosing an option
The segmented control SHALL let a member choose exactly one option among its items
by clicking or tapping it, and SHALL invoke the switcher's change handler with the
chosen option's value.

#### Scenario: Clicking an unselected option
- **WHEN** a member clicks an option that is not currently selected
- **THEN** that option becomes selected and the change handler fires with its value

### Requirement: Keyboard reachable
The segmented control SHALL be operable from the keyboard: the arrow keys move the
selection to the adjacent option, and Home/End jump to the first/last option.

#### Scenario: Arrow key navigation
- **WHEN** a member has keyboard focus on the segmented control and presses the right
  arrow key
- **THEN** the next option becomes selected and receives focus

### Requirement: Draggable selection
The segmented control SHALL allow a member to drag the selected indicator onto
another option, or flick it toward an adjacent option, to select it.

#### Scenario: Dragging to another option
- **WHEN** a member drags the selected indicator onto a different option and
  releases
- **THEN** that option becomes selected

### Requirement: Used for every switcher, including inside modals
Every place in the app that previously rendered a tab-style switcher SHALL render
this segmented control instead, including switchers that appear inside a modal.

#### Scenario: The contact-book modal's directory switcher
- **WHEN** a member opens the contact-book modal
- **THEN** the Clients/Employees selector renders as the segmented control

### Requirement: Accessible role and state
The control's container SHALL expose `role="radiogroup"` with an accessible name,
and each option SHALL expose `role="radio"` with `aria-checked` reflecting whether
it is the selected option.

#### Scenario: Reading the control with assistive technology
- **WHEN** assistive technology inspects the control
- **THEN** it reports a radio group with an accessible name, and each option reports
  its checked state

### Requirement: Reduced motion is respected
A member who prefers reduced motion SHALL still be able to select any option; the
animated travel of the selected indicator SHALL be skipped for that member.

#### Scenario: Selecting an option with reduced motion preferred
- **WHEN** a member with a reduced-motion preference selects an option
- **THEN** the selection updates without an animated indicator movement
