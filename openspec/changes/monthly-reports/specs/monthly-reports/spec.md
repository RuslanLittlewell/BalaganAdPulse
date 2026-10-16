## Purpose

A project's monthly report sums up one finished calendar month of advertising for the
client: what was spent, how many leads it brought and at what cost, how that compares with
earlier months, which ads worked best, and what the agency concludes and plans next.

## ADDED Requirements

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
- the previous month's leads and cost per lead, and the relative change of each;
- a trend of leads and cost per lead for up to six months ending with the report's month,
  starting no earlier than the first month the project has figures;
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

#### Scenario: Synced data changes after generation
- **WHEN** a Meta sync rewrites an August day after the August report was generated
- **THEN** the report keeps its figures until staff refresh it

#### Scenario: Refreshing a report
- **WHEN** staff refresh the August report
- **THEN** its computed figures are recomputed from the current data, and its corrected lead count, texts and chosen ads are kept

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

Staff SHALL be able to set on a report: a count of contacts received through messengers and
social networks, formatted conclusions for the month, a formatted plan for the next month, and
the ads shown as the month's best — chosen among the project's ads that spent in the month, at
most six, in the order staff set.

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
   cost per lead and, when entered, «+ N обращений в соц. сети».
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
