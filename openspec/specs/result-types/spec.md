# result-types Specification

## Purpose
TBD - created by archiving change result-types. Update Purpose after archive.

## Requirements

### Requirement: An ad set records what it optimises for

Importing a Meta account SHALL record, for each ad set, its optimization goal, and SHALL refresh
it on every import. The goal SHALL be reported as a result type: messages for a conversations
goal, visits to the profile for a profile-visit goal, leads, link clicks, landing page views,
conversions, engagement, reach, video views, app installs, or other, and unknown when no goal is
recorded.

#### Scenario: A messages ad set
- **WHEN** an imported ad set optimises for conversations
- **THEN** it is reported with the result type messages

#### Scenario: A goal changes
- **WHEN** the ad set's goal changes at the source and the project is imported again
- **THEN** the ad set is reported with the new type

#### Scenario: Not imported since
- **WHEN** an ad set was imported before goals were recorded
- **THEN** it is reported with the result type unknown

### Requirement: Campaigns, ad sets and ads report their result type

An ad set SHALL report its result type, and an ad SHALL report the type of its ad set. A campaign
SHALL report the types its ad sets optimise for, whatever the period, and a Google campaign SHALL
report the types of its account's conversion categories. The figures of a campaign, an ad set, an
ad, a project summary, a dashboard project and each of its days SHALL include, for the requested
period, the results and the spend of each result type, largest first. A Google campaign, ad group
or ad SHALL take its results of a type from its conversions in that type's categories, and the
spend of each of its types SHALL be its whole spend, since Google does not divide spend between
conversion actions. Results of a campaign with no ad sets other than a Google campaign SHALL be
reported as unknown.

#### Scenario: A campaign of two kinds
- **WHEN** a campaign has one ad set optimising for messages with 120 results and 3000 spent and
  another for profile visits with 45 results and 900 spent in the period
- **THEN** its figures report messages 120 for 3000 and profile visits 45 for 900, and it reports
  the types messages and profile visits

#### Scenario: A quiet period
- **WHEN** a campaign's ad sets optimise for messages but produced nothing in the period
- **THEN** it still reports the type messages, and its figures report no results by type

#### Scenario: An ad
- **WHEN** an ad belongs to an ad set optimising for leads
- **THEN** the ad reports the result type leads

#### Scenario: A project summary
- **WHEN** the summary of a project with messages and profile-visit campaigns is read
- **THEN** it reports the results and spend of each type for the period, and so does each day of
  the dashboard project

#### Scenario: A Google campaign
- **WHEN** a Google campaign that spent 300 in the period holds 4 lead form conversions and 6
  contacts
- **THEN** it reports the types leads and contacts, and its figures report leads 4 for 300 and
  contacts 6 for 300

#### Scenario: A Google ad group
- **WHEN** an ad group of that campaign holds 3 of the lead form conversions
- **THEN** its figures report leads 3

### Requirement: Results of different types are listed apart

Where a row or the «Итого» row would add results of more than one type, the «Результаты» cell
SHALL show the total number of results and the «Цена результата» cell SHALL be blank. Where all
results are of one type, the cells SHALL show the number and the cost per result as before.

#### Scenario: Mixed totals
- **WHEN** a project's campaigns include messages and profile visits
- **THEN** the «Итого» row shows the total results and no cost per result

#### Scenario: One type
- **WHEN** every campaign collects messages
- **THEN** the «Итого» row shows one number and its cost per result

### Requirement: A column pair per result type

The campaign and ad set tables SHALL offer, for each result type of the project's campaigns on the
project page and of the campaign on the campaign page, one column with the results of that type,
named by the type, as «Звонки», and shown by default. Only a type whose name another column of
the table already carries SHALL be named «Результаты - <тип>», as «Результаты - Лиды» beside the
«Лиды» column; a name SHALL appear once among the columns a table offers. A row SHALL show its results of that type, or a
dash when it has none of that type; the «Итого» row SHALL show the sum of the type. The tables
SHALL NOT offer a column for the cost of a type. Unknown SHALL get a column only when the
campaigns have ad sets with no type.

#### Scenario: Two types
- **WHEN** a project's campaigns optimise for messages and for profile visits
- **THEN** the campaign table shows «Сообщения» and «Переходы в профиль», each campaign filled in
  its own type and dashed in the other

#### Scenario: A member who chose columns before
- **WHEN** a member who has hidden some columns opens a table that now offers type columns
- **THEN** the type columns are shown and the columns the member hid stay hidden

#### Scenario: A type named like a metric
- **WHEN** a project's campaigns collect leads and Google calls
- **THEN** the campaign table shows «Лиды», «Результаты - Лиды» and «Звонки»

### Requirement: A KPI on one result type

A project KPI or a campaign KPI on results or on cost per result SHALL be able to name a result
type other than unknown; the organization KPI SHALL NOT. The project's KPI dialog SHALL offer, for
each type of the project's campaigns, the results of that type and their cost, and the campaign's
KPI dialog SHALL offer the same for each type of the campaign; both SHALL keep offering the type of
a saved KPI. The results of a type SHALL be labelled as the type's column is, by the type alone
unless a metric carries the same name, as «Звонки» and «Результаты - Лиды», and their cost
«Цена · <тип>», in the dialogs, on the KPI tile and on the campaign KPI blocks. The KPI's actual
value SHALL be the results of that type in the period, or the type's spend over its results;
results SHALL be prorated over the month like other results, and a lower cost SHALL be better. A
type named on a KPI on any other metric SHALL be refused. The project's KPI standing, the
dashboard, the project list tone and the KPI-met notification SHALL use the same value, and so
SHALL the campaign's indicator and its progress block.

#### Scenario: A messages target
- **WHEN** a project sets a monthly KPI of 300 messages and its campaigns produced 150 messages
  and 400 profile visits by the middle of the month
- **THEN** the KPI counts only the 150 messages against the prorated target and its tile reads
  «KPI · Сообщения»

#### Scenario: A cost target
- **WHEN** a project sets a KPI of 20 per message and its messages cost 3000 for 120 messages
- **THEN** the KPI's actual value is 25 and the KPI is behind

#### Scenario: A type on the wrong metric
- **WHEN** a request names a result type on a KPI on spend
- **THEN** it is refused

#### Scenario: A campaign's messages target
- **WHEN** a manager sets a campaign KPI of 20 per message and reads the campaign back
- **THEN** the campaign's KPI names the messages type

#### Scenario: Not on the organization
- **WHEN** a request names a result type on the organization KPI
- **THEN** it is refused and the organization KPI is unchanged

### Requirement: Google conversion categories are result types

Importing a Google account SHALL record the categories of the account's enabled conversion
actions and, for each campaign, ad group and ad and each day, all its conversions in each
category, as Google's «Все конверсии» count them, including actions outside the campaigns' goals.
A category SHALL be reported as a result type: lead forms, imported leads and quote requests as
leads; qualified and converted leads as qualified leads; phone calls as calls; contacts as
contacts; booked appointments as appointments; requests for directions as directions; purchases,
store sales and paid subscriptions as purchases; items added to a cart and begun checkouts as
checkouts; sign-ups as sign-ups; page views as landing page views; outbound clicks as link
clicks; engagement as engagement; downloads as app installs; and any other category as other.

A Google campaign SHALL report the types of its account's enabled conversion actions and of any
conversions recorded for it, whatever the period. A Google campaign imported before categories
were recorded SHALL report conversions, taken from its results, until it is imported again.

The Russian names of the new types SHALL be: Квалифицированные лиды, Звонки, Контакты, Записи,
Маршруты, Покупки, Оформления заказа, Регистрации.

#### Scenario: The categories of an account
- **WHEN** an account's enabled conversion actions are a lead form, a click on the phone number
  counted as a contact and calls from ads
- **THEN** each of its campaigns reports the types leads, contacts and calls

#### Scenario: Conversions outside the goals
- **WHEN** a campaign's calls from ads are not among its goals and it had 4 of them in the period
- **THEN** its figures report calls 4

#### Scenario: Two actions of one category
- **WHEN** a campaign had 1 conversion on one lead form and 4 on another on a day
- **THEN** its figures for that day report leads 5

#### Scenario: A hidden action that converted
- **WHEN** a hidden purchase action recorded a conversion for a campaign
- **THEN** the campaign also reports the type purchases

#### Scenario: Not imported since
- **WHEN** a Google campaign was last imported before categories were recorded
- **THEN** it reports the type conversions, with its results as before
