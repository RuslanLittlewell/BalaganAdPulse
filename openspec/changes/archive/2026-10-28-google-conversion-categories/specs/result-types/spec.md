## MODIFIED Requirements

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

## ADDED Requirements

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
