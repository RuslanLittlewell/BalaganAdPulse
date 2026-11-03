## MODIFIED Requirements

### Requirement: Figures are computed from the project's synced data and stored

Generating a report SHALL compute and store, for the report's month and in the project's
currency:

- spend: the sum of the project's campaign spend;
- leads: the sum of the project's campaign leads, the Meta `lead` action;
- cost per lead: spend divided by leads, absent when there are no leads;
- the month's results per result type, counted as the campaign screens count them: Meta results
  by the type of their ad set's optimisation goal, Google conversions by the type of their
  conversion category;
- the previous month's leads and cost per lead, and the relative change of each;
- a trend of leads and cost per lead for up to six months ending with the report's month,
  starting no earlier than the first month the project has figures or a month entered by hand
  for the trend, whichever comes first;
- the best ads of the month: up to three ads with the most leads, ties going to the lower
  spend, each with its leads, spend, cost per lead and creative.

The stored figures SHALL NOT change when the synced data changes later, until staff refresh
the report.

#### Scenario: A report's headline figures
- **WHEN** the project spent 3080.77 and recorded 95 leads in August
- **THEN** the August report shows spend 3080.77, 95 leads and cost per lead 32.4292

#### Scenario: Change against the previous month
- **WHEN** July had 69 leads and August has 95
- **THEN** the August report shows leads up 37.7% against July

#### Scenario: A month without leads
- **WHEN** the project spent money in a month but recorded no leads
- **THEN** the report shows zero leads and no cost per lead

#### Scenario: Results per type
- **WHEN** in August a Meta ad set optimised for conversations recorded 105 results and a Google
  campaign recorded 12 phone-call conversions
- **THEN** the August report stores 105 messages and 12 calls

#### Scenario: Synced data changes after generation
- **WHEN** a Meta sync rewrites an August day after the August report was generated
- **THEN** the report keeps its figures until staff refresh it

#### Scenario: Refreshing a report
- **WHEN** staff refresh the August report
- **THEN** its computed figures are recomputed from the current data, and its corrected lead count, chosen fourth figure, texts and chosen ads are kept

### Requirement: Staff complete the report by hand

Staff SHALL be able to set on a report: formatted conclusions for the month, a formatted plan
for the next month, and the ads shown as the month's best, chosen among the project's ads that
spent in the month, at most six, in the order staff set.

#### Scenario: Writing the conclusions and plan
- **WHEN** staff write the conclusions and the plan with bold text and a numbered list
- **THEN** readers of the report see them with that formatting

#### Scenario: Choosing the best ads
- **WHEN** staff remove one suggested ad, add another ad that spent in the month and move it first
- **THEN** the report shows the chosen ads in that order, each with its month's leads and cost per lead

#### Scenario: Choosing an ad that did not run
- **WHEN** staff choose an ad with no spend in the report's month
- **THEN** the API responds 400 and the selection is unchanged

### Requirement: A report downloads as a PDF on the agency template

Everyone who reads a report SHALL be able to download it as a PDF of 16:9 slides following the
agency's report template, in this order:

1. A cover with the agency's logo, «ОТЧЁТ ПО РЕКЛАМЕ» and the client's name, «за» and the
   month, and on its right half the report's cover picture, else the picture of the first best
   ad, else a dark panel.
2. «ИТОГИ МЕСЯЦА» with «Лидогенерация — » and the project's name, the spend, the leads, the
   cost per lead and, when the fourth figure is above zero, a line stating it: «+ N обращений в
   соц. сети» for a count entered by hand, or the result type's name and its total, such as
   «+ Сообщения: 105», for a chosen result type.
3. The trends of leads and of cost per lead, each point labelled with its value.
4. One slide per best ad, in the chosen order: its picture (a video's poster) and «Результат:»
   with its leads and cost per lead.
5. «ВЫВОДЫ ЗА МЕСЯЦ» with the formatted conclusions, when written.
6. «ПЛАН РАБОТ НА СЛЕДУЮЩИЙ МЕСЯЦ» with the formatted plan, when written.

The file SHALL be named «Отчет <client> _ <Month> <year>.pdf» and SHALL show the report's
corrected figures. Every title in a slide's dark panel SHALL stay inside the panel, its type
made smaller when its longest word would not fit.

#### Scenario: Downloading a full report
- **WHEN** a client downloads the August report of client AURORA with three best ads, conclusions and a plan
- **THEN** a file «Отчет AURORA _ Август 2026.pdf» is saved with a cover, the summary, the trends, three ad slides, the conclusions and the plan

#### Scenario: A report without texts
- **WHEN** a report without conclusions or plan is downloaded
- **THEN** the PDF has no conclusions and no plan slide

#### Scenario: Corrected leads in the PDF
- **WHEN** staff corrected August leads to 90 and download the report
- **THEN** the summary slide states 90 leads and the cost per lead computed from 90

#### Scenario: A chosen result type in the PDF
- **WHEN** the August report shows messages as its fourth figure, with 105 messages
- **THEN** the summary slide states «+ Сообщения: 105»

#### Scenario: The cover
- **WHEN** a report with an uploaded cover picture is downloaded
- **THEN** the cover shows the agency's logo and the uploaded picture on its right half

#### Scenario: A long panel title
- **WHEN** a report with a plan is downloaded
- **THEN** «ПЛАН РАБОТ НА СЛЕДУЮЩИЙ МЕСЯЦ» fits inside the dark panel, no word crossing its edge

## ADDED Requirements

### Requirement: Staff choose what the fourth headline figure shows

The fourth headline figure of a report SHALL show either the stored total of one result type
the project recorded in the report's month, under that type's Russian name, or a count entered
by hand, under «Обращения в соцсети и мессенджеры». Staff SHALL choose between them from a list
of the hand-entered count and every result type with results in the report's stored figures.
Readers SHALL see the name and the value only. A newly generated report SHALL show messages when
its month has any, and the hand-entered count otherwise. Choosing a result type that has no
results in the stored figures SHALL be refused with 400. A report whose figures were stored
before results per type existed SHALL offer only the hand-entered count until staff refresh it.
After a refresh the report SHALL keep the chosen type and show 0 when the type no longer has
results.

#### Scenario: A new report with messages
- **WHEN** staff generate the August report of a project whose Meta ad sets started 105 conversations in August
- **THEN** the fourth figure reads «Сообщения» with 105

#### Scenario: A new report without messages
- **WHEN** staff generate a report for a month with no messages
- **THEN** the fourth figure reads «Обращения в соцсети и мессенджеры» with no value until staff enter one

#### Scenario: Choosing another type
- **WHEN** staff choose calls on a report whose stored figures hold 12 calls
- **THEN** the fourth figure reads «Звонки» with 12, for staff and for the client

#### Scenario: Going back to a count entered by hand
- **WHEN** staff choose the hand-entered count and enter 40
- **THEN** the fourth figure reads «Обращения в соцсети и мессенджеры» with 40

#### Scenario: A type without results
- **WHEN** staff choose profile visits on a report whose stored figures have none
- **THEN** the API responds 400 and the choice is unchanged

#### Scenario: A report from before the change
- **WHEN** staff open a report generated before results per type were stored
- **THEN** only the hand-entered count is offered, and after a refresh the month's result types are offered too

#### Scenario: The client does not see the choice
- **WHEN** a client opens a published report showing messages
- **THEN** they see «Сообщения» and its value and no control to change it

### Requirement: Staff enter past months of the trend by hand

Staff SHALL be able, from a report, to enter leads and optionally spend for any of the five
months before the report's month, and to clear such an entry. An entry SHALL belong to the
project, not to the report. For an entered month, every report's trend, previous-month figures
and change against the previous month SHALL use the entered leads instead of the synced count
and of a correction made on that month's report, and the entered spend, when given, instead of
the synced spend. The report the entries were made from SHALL show them at once; any other report
SHALL use them when it is generated or refreshed. Entering a month outside the five months
before the report's month, a negative or fractional lead count, or a negative spend SHALL be
refused with 400. Staff SHALL see which months hold an entry; readers SHALL see only the trend.

#### Scenario: Filling months before the connection
- **WHEN** the project's figures start in September and staff enter 40 leads at spend 900 for June, 52 for July and 61 for August from the October report
- **THEN** the October trend shows June, July and August with those leads, the cost per lead for June is 22.5 and the months without spend have no cost per lead

#### Scenario: An entry wins over synced figures
- **WHEN** September has 58 synced leads and staff enter 64 for September from the October report
- **THEN** the October trend and its change against the previous month use 64 for September

#### Scenario: Clearing an entry
- **WHEN** staff clear the September entry
- **THEN** the October trend shows the 58 synced leads again

#### Scenario: Another report picks up entries on refresh
- **WHEN** staff entered July from the October report and then refresh the September report
- **THEN** the September trend shows the entered July figures

#### Scenario: A month outside the trend
- **WHEN** staff send an entry for the report's own month or for a month six months back
- **THEN** the API responds 400 and no entry is saved

#### Scenario: The client sees the trend only
- **WHEN** a client opens a published report with entered months
- **THEN** the trend shows the entered figures and there is no control to change them
