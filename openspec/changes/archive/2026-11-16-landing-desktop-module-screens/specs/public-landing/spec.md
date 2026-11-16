## MODIFIED Requirements

### Requirement: The landing wears the app's look

The landing SHALL use the web app's colours, light or dark after the visitor's system preference.
Its opening SHALL greet the visitor as the app's sign-in page does: the light rays behind, and the
handwritten Balagan signature centred above the heading and its lead text. Below the lead text the
opening SHALL offer a free one-month trial and signing in to the app. Choosing the trial SHALL lead to
the contact form with the topic Пробный период chosen, since organisations are created by the
platform administrator and nobody registers without an invitation. Below the actions the opening
SHALL show an imitation of the app's dashboard across the full width of the content, laid out as
the dashboard is: its navigation, the header with the period, the summary tiles, a row with the
month's KPI doughnut, the important notices, the tasks due soon and the sources, and the projects
below them. As the imitation comes into view it SHALL load its
figures and rate each project against its KPI; a reader without scripts or preferring reduced
motion SHALL see it finished. Below the opening the
page SHALL have its plain background colour, with nothing moving behind it, and its sections and
cards SHALL appear as they are scrolled into view. Each section of the home page SHALL span the
page's width and SHALL sit on the page itself, with no rounded box around the whole section and no
empty screen-high space around a short section; cards inside a section keep their own frames. Every animation SHALL stand still for a visitor who prefers reduced motion,
and the pages SHALL read the same where WebGL or scripts are unavailable.

#### Scenario: Reduced motion
- **WHEN** a visitor who prefers reduced motion opens the home page
- **THEN** the rays and the signature stand still, and every section is shown at once

#### Scenario: Without scripts
- **WHEN** the home page is read without running scripts
- **THEN** every section and card is in place, none of them waiting to appear

#### Scenario: A section owns the screen
- **WHEN** a visitor scrolls from the features section to the modules
- **THEN** no rounded box frames the features, and the modules follow them without a screen of
  empty space between

#### Scenario: Nothing moves behind the sections
- **WHEN** a visitor scrolls past the opening
- **THEN** the sections sit on the plain page background, with no animated waves behind them

#### Scenario: The opening
- **WHEN** a visitor opens the home page
- **THEN** the signature is written above the centred heading and lead text, followed by the
  trial and sign-in actions and the dashboard imitation, which then fills in its figures

#### Scenario: Asking for a trial
- **WHEN** a visitor chooses Попробовать бесплатно
- **THEN** the page scrolls to the contact form with the topic Пробный период chosen, and no
  registration form is offered

### Requirement: The modules unfold as the visitor scrolls

On a wide screen, the modules section SHALL hold the screen still while the visitor scrolls
through it. It SHALL open with the section's heading beside the six module imitations fanned out
in depth. Scrolling on SHALL bring the imitations forward one at a time, in the order Дашборд,
Проекты, Задачи, CRM, Отчёты, Команда и доступ: the current one tilted in 3D in front, the one
before it receding to one side and the next waiting on the other, with the current module's name,
description and points beside it. Each imitation SHALL look like
a screenshot of the app on a desktop screen: a window of a desktop's proportions with the app's
address bar, its navigation with the module chosen, and the module's page laid out as the app lays
it out, scaled down whole to the space it has. The imitation that comes forward SHALL play its
animation. Below
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

#### Scenario: A module looks like the app on a desktop
- **WHEN** the Задачи imitation is in front
- **THEN** it shows a desktop-proportioned window with the app's navigation, Задачи chosen, and
  the board with its seven columns
