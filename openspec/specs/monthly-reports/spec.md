# monthly-reports Specification

## Purpose
TBD - created by archiving change client-report-files. Update Purpose after archive.

## Requirements

### Requirement: A customer sees each report as a file

For a customer the Reports module SHALL show, in place of the table, one tile for each report
they may read, newest month first. A tile SHALL show a white file icon, the report's month and
year written out, such as «Сентябрь 2026», and the report's project beneath, and SHALL open
the report. The filter by project SHALL narrow the tiles as it narrows the table. Staff and
guests SHALL keep the table.

#### Scenario: A client opens Отчёты
- **WHEN** a client whose project «Окна» has published August and September reports opens Отчёты
- **THEN** they see two files, «Сентябрь 2026» first and «Август 2026» second, each naming
  «Окна», and no table of figures

#### Scenario: Opening a file
- **WHEN** the client chooses the «Сентябрь 2026» file
- **THEN** the September report opens

#### Scenario: Staff keep the table
- **WHEN** a manager opens Отчёты
- **THEN** the reports are listed in the table with their figures and status

### Requirement: Staff are told that a draft is hidden from the client

Where staff see a draft — on the draft's page beside its status, and under the report list
when any listed report is a draft — the interface SHALL say that the client does not see the
report until it is published.

#### Scenario: A new report
- **WHEN** a manager creates a report and it opens as a draft
- **THEN** the page says the client will not see it until it is published

#### Scenario: A published report
- **WHEN** a manager opens a published report
- **THEN** no such notice is shown

#### Scenario: The list with a draft
- **WHEN** a manager opens Отчёты and one of the listed reports is a draft
- **THEN** the list says that the client does not see drafts until they are published

### Requirement: A report covers one finished month of one project

A project SHALL hold at most one report per calendar month. A report SHALL be generated only
for a month that has ended: the month's last day has passed in the timezone of every
advertising connection of the project, or in UTC when the project has none. Generating a
second report for the same month SHALL be refused as a conflict.

#### Scenario: Generating last month's report
- **WHEN** on 1 September a manager who reaches the project generates the August report
- **THEN** the report is created as a draft covering 1–31 August

#### Scenario: Generating the current month
- **WHEN** on 20 September a manager generates the September report
- **THEN** the API responds 400 and nothing is stored

#### Scenario: A month still running in the account's timezone
- **WHEN** the project's Meta account is in America/Chicago and an August report is requested at 02:00 UTC on 1 September
- **THEN** the API responds 400, because August has not ended in Chicago

#### Scenario: Generating the same month twice
- **WHEN** an August report exists and another August report is requested for the project
- **THEN** the API responds 409

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

### Requirement: Staff correct the lead count by hand

Staff SHALL be able to set a corrected lead count on a report and to clear it. While set, the
corrected count SHALL replace the computed count in the report's leads, cost per lead and
change against the previous month, and the computed count SHALL remain visible to staff. A
later report's previous-month figures and trend SHALL use an earlier month's corrected count
when that month has a report with one.

#### Scenario: Correcting leads
- **WHEN** staff set the August leads to 90 on a report that computed 95 with spend 3080.77
- **THEN** the report shows 90 leads and cost per lead 34.2308, and staff still see that 95 were computed

#### Scenario: Clearing the correction
- **WHEN** staff clear the corrected lead count
- **THEN** the report shows the computed count again

#### Scenario: A corrected month in a later trend
- **WHEN** the July report's leads were corrected to 70 and the September report is generated
- **THEN** the September trend and its change against the previous month use 70 for July

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

### Requirement: A report is published before customers see it

A report SHALL be created as a draft. Staff SHALL be able to publish it and to return it to
draft. Drafts SHALL be visible to admins and managers who reach the project only; every
other member who reaches the project SHALL see published reports only, and a draft SHALL
answer them as not found.

#### Scenario: A client opens the report list
- **WHEN** the project has a published July report and a draft August report and a client of the project lists reports
- **THEN** only the July report is listed

#### Scenario: A client opens a draft directly
- **WHEN** a client requests the draft August report by its address
- **THEN** the API responds 404

#### Scenario: Publishing
- **WHEN** a manager publishes the August report
- **THEN** the project's client people see it in their list

### Requirement: Reports follow the project's reach and the shared matrix

Admins, and managers who reach the project, SHALL generate, edit, refresh, publish, return to
draft and delete its reports. Every member who reaches the project SHALL read its published
reports. Every other request SHALL be refused, and a report of a project the member does not
reach SHALL answer as not found.

#### Scenario: A manager without the project
- **WHEN** a manager who does not reach the project requests one of its reports
- **THEN** the API responds 404

#### Scenario: A client edits a report
- **WHEN** a client of the project tries to change a published report
- **THEN** the API responds 403 and the report is unchanged

#### Scenario: Deleting a report
- **WHEN** an admin deletes the August report
- **THEN** it is gone and an August report can be generated again

### Requirement: The Reports module holds every report

The Reports module SHALL be shown in the main navigation to every role. It SHALL list the
reports of every project the member reaches, newest month first, each with its project, month
and headline figures, and SHALL filter the list by project. Staff SHALL see each report's
status and SHALL create a report by choosing a project and one of that project's twelve most
recent ended months that have no report. A report SHALL open at its own address in the module,
showing in order: the headline figures with messenger contacts, the trend of leads and cost per
lead, the best ads with their creatives and figures, the conclusions and the plan. Staff SHALL
edit the hand-entered parts in place; customers SHALL see no editing controls. The project page
SHALL NOT show reports.

#### Scenario: A client opens the module
- **WHEN** a client whose two projects each have a published report opens Отчёты
- **THEN** both reports are listed with their projects, and no draft and no create control appear

#### Scenario: Filtering by project
- **WHEN** a manager filters the module by one project
- **THEN** only that project's reports are listed

#### Scenario: Staff create a report
- **WHEN** on 5 October a manager chooses a project that has a September report and opens the month choice
- **THEN** August and the earlier ended months without a report are offered, September is not, and creating one opens the new draft

#### Scenario: A client reads a report
- **WHEN** a client opens the published August report
- **THEN** they see spend, leads, cost per lead, the trend, the best ads, the conclusions and the plan, and no control to edit, refresh, publish or delete

#### Scenario: The project page
- **WHEN** anyone opens a project that has reports
- **THEN** the project page shows no reports section

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

### Requirement: Staff set a cover picture for a report

Staff SHALL be able to upload a cover picture for a report — a JPEG, PNG or WebP image up to
10 MB — by dropping a file onto the cover block or choosing one from it, replace it the same
way and remove it. Every reader of the report SHALL see the picture beside
the headline figures at the top of the report, and the PDF SHALL use it on its cover. The picture SHALL be
served by the API only to members who read the report. Customers SHALL NOT change it.

#### Scenario: Uploading a cover
- **WHEN** a manager uploads a photo as the August report's cover
- **THEN** the report shows it beside the headline figures, and a client reading the published report sees it too

#### Scenario: Dropping a picture onto the cover block
- **WHEN** a manager drags a photo over the cover block and drops it
- **THEN** the block shows that it will take the file while it is over it, and the photo becomes the cover

#### Scenario: A file that is not a picture
- **WHEN** staff upload a PDF or a 20 MB image as the cover
- **THEN** the API responds 400 and the cover is unchanged

#### Scenario: Removing the cover
- **WHEN** staff remove the cover
- **THEN** the report shows no picture and the PDF cover falls back to the first best ad's picture

#### Scenario: A client changes the cover
- **WHEN** a client tries to upload or remove a cover
- **THEN** the API responds 403

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
