## MODIFIED Requirements

### Requirement: The landing wears the app's look

The landing SHALL use the web app's colours, light or dark after the visitor's system preference.
The header SHALL carry a control at its left edge that switches between the light and the dark
scheme. The visitor's choice SHALL be remembered in their browser, SHALL apply from the first paint
of the next visit on any page of the landing, and SHALL override the system preference; without a
choice, the system preference applies.
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
page SHALL have its background colour under a fine, still diagonal hatching, the same on every
page of the landing, with nothing moving behind it; the opening keeps its plain background behind
the rays, and its sections and
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
- **THEN** the sections sit on the hatched page background, with no animated waves behind them

#### Scenario: The opening
- **WHEN** a visitor opens the home page
- **THEN** the signature is written above the centred heading and lead text, followed by the
  trial and sign-in actions and the dashboard imitation, which then fills in its figures

#### Scenario: Asking for a trial
- **WHEN** a visitor chooses Попробовать бесплатно
- **THEN** the page scrolls to the contact form with the topic Пробный период chosen, and no
  registration form is offered

#### Scenario: Switching the scheme
- **WHEN** a visitor whose system is dark chooses the light scheme in the header
- **THEN** the page turns light at once, and stays light on the next page and the next visit

#### Scenario: No choice made
- **WHEN** a visitor who never used the control opens the page on a light system
- **THEN** the page is light, and follows the system if it changes
