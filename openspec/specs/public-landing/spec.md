# public-landing Specification

## Purpose
TBD - created by archiving change public-landing. Update Purpose after archive.

## Requirements

### Requirement: BalaganBI has a public home page that explains it

The landing host SHALL answer its root with a page that anyone can read without signing in. The
page SHALL name the app BalaganBI, as on the Google consent screen, and SHALL state in its served
HTML, without depending on scripts: what BalaganBI does; that a Google Ads account is connected by
its user signing in with Google; which Google Ads data is read, that it is only read and never
changed, and what it is used for; that it is not sold, shared or used for advertising or to train
AI models; and how access is revoked. It SHALL link to the privacy policy and to the app's sign-in.
It SHALL be in Russian with an English section.

#### Scenario: A visitor who is not signed in
- **WHEN** anyone opens `https://bi.balagan.pro/`
- **THEN** the page explains BalaganBI and its use of Google Ads data, with no sign-in asked

#### Scenario: A reader without scripts
- **WHEN** the home page is fetched as plain HTML
- **THEN** the explanation and the link to the privacy policy are in the document

### Requirement: BalaganBI publishes a privacy policy covering Google user data

The landing host SHALL serve a privacy policy at `/privacy`, readable without signing in, stating
who provides the service and how to reach them, which data is processed, which Google Ads data is
obtained through which permission and why, how it is stored and protected, that it is not sold,
shared, used for advertising or to train AI models, how access is revoked and data deleted, and
that the use of information received from Google APIs adheres to the Google API Services User Data
Policy, including the Limited Use requirements.

#### Scenario: Reading the policy
- **WHEN** anyone opens `https://bi.balagan.pro/privacy`
- **THEN** the policy is shown, including the Limited Use statement and a contact address

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

### Requirement: The landing is served by the app on its own host

The application SHALL serve the built landing to requests for the landing host, configured by
`LANDING_HOST` and `bi.balagan.pro` by default, and SHALL answer a path the landing does not have
with the landing's not-found page and status 404. Requests for any other host SHALL reach the API
and the web app exactly as before. The landing SHALL be built and shipped in the same image and
deployment as the API and the web app.

#### Scenario: The landing host
- **WHEN** a request for `bi.balagan.pro` asks for `/`
- **THEN** the landing's home page is served, not the web app

#### Scenario: The app host
- **WHEN** a request for `app.balagan.pro` asks for `/`
- **THEN** the web app is served as before

#### Scenario: No API on the landing host
- **WHEN** a request for `bi.balagan.pro` asks for `/api/projects`
- **THEN** the landing's not-found page answers with 404

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

### Requirement: The connections section shows what BalaganBI connects to

The connections section SHALL open with its heading, a lead text and the same free-trial action
as the opening, leading to the contact form with the topic Пробный период chosen, followed by a
bento of three diagrams above the connection guides:
the client's accounts flowing through BalaganBI into reports, a hub of every integration, and the
last 30 days of figures. The hub SHALL name the integrations BalaganBI has, Meta Ads, Google Ads,
Google Search Console and Telegram, and SHALL mark the planned ones, Яндекс Директ and TikTok Ads,
as coming soon. Every name and status SHALL be in the served document as text. While the bento is
on screen, the diagrams SHALL move: data travels along the connectors, the report count grows, the
hub syncs the connected integrations one at a time, and the chart shows the day under the
pointer. For a visitor who prefers reduced motion they SHALL stand still.

#### Scenario: Reading the hub
- **WHEN** the home page is read without running scripts
- **THEN** the connections section names Meta Ads, Google Ads, Google Search Console and Telegram
  as connected, and Яндекс Директ and TikTok Ads as coming soon

#### Scenario: The hub syncs
- **WHEN** the bento comes into view
- **THEN** the hub highlights the connected integrations one after another, never a planned one

#### Scenario: Pointing at the chart
- **WHEN** a visitor moves the pointer across the chart
- **THEN** the chart marks the nearest day and shows that day's leads

#### Scenario: Reduced motion
- **WHEN** a visitor who prefers reduced motion scrolls to the connections section
- **THEN** no connector carries moving data and the report count stays as it is

#### Scenario: Asking for a trial from the connections
- **WHEN** a visitor chooses Попробовать бесплатно in the connections section
- **THEN** the page scrolls to the contact form with the topic Пробный период chosen

### Requirement: The contact form collects an email and a phone

The landing's contact form SHALL ask for a required email address and an optional phone number besides the topic and message. The browser SHALL refuse to submit the form while the email is empty or malformed. The mail draft SHALL include the entered email and, when given, the phone. The page SHALL load the lead intake script so that a valid submission also reaches the CRM.

#### Scenario: A visitor leaves the email empty
- **WHEN** a visitor submits the contact form without an email
- **THEN** the form is not submitted and the email field is reported

#### Scenario: A visitor adds a phone
- **WHEN** a visitor fills the email and the phone and submits
- **THEN** the mail draft contains both values and the lead intake script receives them
