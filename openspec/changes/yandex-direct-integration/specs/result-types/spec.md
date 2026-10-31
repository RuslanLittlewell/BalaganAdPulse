## MODIFIED Requirements

### Requirement: Campaigns, ad sets and ads report their result type

An ad set SHALL report its result type, and an ad SHALL report the type of its ad set. A campaign
SHALL report the types its ad sets optimise for, whatever the period, and a Google campaign SHALL
report the types of its account's conversion categories. A Yandex campaign, ad group and ad SHALL
report the type conversions, and their results of that type SHALL be their conversions, with
their whole spend. The figures of a campaign, an ad set, an
ad, a project summary, a dashboard project and each of its days SHALL include, for the requested
period, the results and the spend of each result type, largest first. A Google campaign, ad group
or ad SHALL take its results of a type from its conversions in that type's categories, and the
spend of each of its types SHALL be its whole spend, since Google does not divide spend between
conversion actions. Results of a campaign with no ad sets other than a Google or Yandex campaign
SHALL be reported as unknown.

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

#### Scenario: A Yandex campaign
- **WHEN** a Yandex campaign spent 500 and had 9 conversions in the period
- **THEN** it reports the type conversions, and its figures report conversions 9 for 500

#### Scenario: A Yandex ad group
- **WHEN** an ad group of that campaign had 4 of the conversions and spent 200
- **THEN** it reports the type conversions, and its figures report conversions 4 for 200
