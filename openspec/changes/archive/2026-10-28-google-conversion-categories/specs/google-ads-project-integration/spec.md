## MODIFIED Requirements

### Requirement: Google Ads campaigns and daily figures are imported

The server SHALL import the connected account's campaigns, ad groups, ads and their daily spend,
impressions, clicks, conversions, all conversions by category and conversion value into the
project, with the same hierarchy,
schedule, retries, one-active-import rule, last-30-days window, idempotence and
no-partial-publication rule as for Meta. Spend SHALL be converted from Google's millionths of
the currency to a four-decimal amount without rounding error. Conversions and revenue SHALL be
the account's own conversion figures, and results SHALL be all conversions, Google's
«Все конверсии», rounded to a whole number. The import SHALL also read the categories of the
account's enabled conversion actions. Reach, which Google does not report at every level, SHALL
be stored as zero where it is missing. Imported data MUST retain external identifiers. The
import SHALL NOT read or copy creative files.

#### Scenario: Repeat import
- **WHEN** the same account is synchronized twice
- **THEN** existing imported entities and daily figures are updated without duplicates

#### Scenario: Incomplete provider response
- **WHEN** any required page fails or holds invalid data
- **THEN** no partial import is published and the previous successful data remains readable

#### Scenario: Spend in micros
- **WHEN** Google reports a day's cost as 12345678 millionths
- **THEN** the project shows 12.3457 in the account's currency

#### Scenario: Currency mismatch
- **WHEN** the account's currency differs from the project's after figures exist
- **THEN** the import is refused and explained without converting amounts

#### Scenario: All conversions as results
- **WHEN** a campaign had 1 conversion towards its goals and 3.9966 conversions in all on a day
- **THEN** that day shows 1 conversion and 4 results, and its conversions by category keep 3.9966
