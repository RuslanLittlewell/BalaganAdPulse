## MODIFIED Requirements

### Requirement: The landing wears the app's look

The landing SHALL use the web app's colours, light or dark after the visitor's system preference.
Its opening SHALL greet the visitor as the app's sign-in page does: the light rays behind, and the
handwritten Balagan signature centred above the heading and its lead text. The rest of the page
SHALL have the app's animated waves behind it, and its sections and cards SHALL appear as they are
scrolled into view. Each section of the home page SHALL take at least the full height of the
screen and SHALL sit on the page itself, with no rounded box around the whole section; cards inside
a section keep their own frames. Every animation SHALL stand still for a visitor who prefers reduced motion,
and the pages SHALL read the same where WebGL or scripts are unavailable.

#### Scenario: Reduced motion
- **WHEN** a visitor who prefers reduced motion opens the home page
- **THEN** the rays, the waves and the signature stand still, and every section is shown at once

#### Scenario: Without scripts
- **WHEN** the home page is read without running scripts
- **THEN** every section and card is in place, none of them waiting to appear

#### Scenario: A section owns the screen
- **WHEN** a visitor scrolls to the features section on a laptop
- **THEN** the section fills the screen, and no rounded box frames it

## ADDED Requirements

### Requirement: The modules unfold as the visitor scrolls

On a wide screen, the modules section SHALL hold the screen still while the visitor scrolls
through it. It SHALL open with the section's heading beside the six module imitations fanned out
in depth. Scrolling on SHALL bring the imitations forward one at a time, in the order Дашборд,
Проекты, Задачи, CRM, Отчёты, Команда и доступ: the current one tilted in 3D in front, the one
before it receding to one side and the next waiting on the other, with the current module's name,
description and points beside it. The imitation that comes forward SHALL play its animation. Below
the deck, the module names SHALL show which module is current and how far the visitor has scrolled
through it, and choosing a name SHALL scroll to that module. Scrolling back SHALL play the deck in
reverse.

On a narrow screen, for a visitor who prefers reduced motion and without scripts, the section
SHALL list every module one after another, each with its name, description, points and imitation,
and SHALL offer no module names to choose from.

#### Scenario: Scrolling through the deck
- **WHEN** a visitor on a laptop scrolls from the section's heading
- **THEN** the screen holds still, the Дашборд imitation comes forward from the fan with its
  description beside it, and on further scrolling it recedes as Проекты comes forward

#### Scenario: Jumping to a module
- **WHEN** a visitor chooses Отчёты below the deck
- **THEN** the page scrolls until the Отчёты imitation is in front with its description

#### Scenario: Reduced motion
- **WHEN** a visitor who prefers reduced motion opens the modules section
- **THEN** the six modules are listed one after another with their imitations, and nothing holds
  the screen or tilts

#### Scenario: Without scripts
- **WHEN** the home page is read without running scripts
- **THEN** every module's name, description, points and imitation is in the document
