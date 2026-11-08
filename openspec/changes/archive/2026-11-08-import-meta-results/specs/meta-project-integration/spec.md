## MODIFIED Requirements

### Requirement: Idempotent advertising import

The server SHALL import campaigns, ad sets, ads and daily spend, impressions, reach, clicks, conversions, results and revenue into the connected project using all result pages. The initial and subsequent imports SHALL refresh the last 30 completed days in the account's timezone. Daily metrics SHALL be requested separately at each hierarchy level to preserve non-additive reach. Conversions SHALL use Meta's aggregate `lead` action, and revenue SHALL use aggregate `purchase` action values, with missing values zero and no summation of overlapping aliases. Results SHALL use Meta's `results` field — the figure Ads Manager shows as Results, counted towards the goal each ad set is optimised for — summing the default-attribution value of every indicator the row reports, with a missing field zero and a fractional value rounded to the nearest whole result. Imported data MUST retain external identifiers. Currency mismatch with the project SHALL prevent import and be explained without silently converting amounts. The import SHALL NOT read or copy creatives; those are fetched when an ad's preview is first opened.

#### Scenario: Repeat import
- **WHEN** the same account is synchronized twice
- **THEN** existing imported entities and daily metrics are updated without duplicates
- **AND** unrelated manual data and older history remain intact

#### Scenario: Incomplete provider response
- **WHEN** any required page fails or contains invalid data
- **THEN** no partial import is published and the previous successful data remains readable

#### Scenario: Existing external identifier belongs elsewhere
- **WHEN** a campaign external identifier already belongs to a different project
- **THEN** the import fails with a generic conflict without moving data or disclosing the other project

#### Scenario: Creatives stay out of the import
- **WHEN** an account is synchronized
- **THEN** no creative is read or copied, and the hierarchy and metrics are imported on their own

#### Scenario: Results follow the optimisation goal
- **WHEN** a campaign optimised for replies reports 56 started conversations as its results and 2 `lead` actions for a day
- **THEN** that day is imported with 56 results and 2 conversions

#### Scenario: A day with no results
- **WHEN** a row carries no `results` field
- **THEN** the day is imported with zero results
