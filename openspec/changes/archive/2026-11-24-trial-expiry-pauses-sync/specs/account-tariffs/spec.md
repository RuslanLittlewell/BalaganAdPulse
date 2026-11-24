## ADDED Requirements

### Requirement: An expired trial pauses integration imports

When a `TRIAL` organization's `trialEndsAt` has passed, the system SHALL NOT start any background job for it that calls an external service: the ad metrics import, the Meta lead poll, the Search Console import, the Analytics traffic import and the site page check. A job already running SHALL finish. Stored metrics, leads and statistics SHALL stay readable and unchanged. Jobs for other organizations SHALL be unaffected.

A paused integration SHALL keep its schedule, so that once the platform administrator assigns a tariff its next run is already due and the system takes it on its next pass, without the member pressing anything.

The web app SHALL tell an organization administrator, in the read-only notice, that data is no longer updated from integrations. Web copy is Russian.

#### Scenario: Daily import after trial
- **WHEN** an integration of an organization whose trial has ended comes due for its daily import
- **THEN** no job is started and no request goes to the ad platform

#### Scenario: Lead poll after trial
- **WHEN** a Meta integration with lead import enabled belongs to an organization whose trial has ended
- **THEN** no lead poll is started for it

#### Scenario: Search and traffic imports after trial
- **WHEN** a site of an organization whose trial has ended comes due for a Search Console import, an Analytics import or a page check
- **THEN** none of them is started

#### Scenario: A manual refresh after trial
- **WHEN** a member of such an organization presses «Обновить»
- **THEN** the API responds 403 as for any write, and no job is queued

#### Scenario: A running job
- **WHEN** a job is running when the trial ends
- **THEN** it finishes and stores its result, and no further job starts

#### Scenario: Another organization
- **WHEN** one organization's trial has ended and another organization on a paid tariff has integrations due
- **THEN** the other organization's jobs run as usual

#### Scenario: Stored data stays
- **WHEN** a member of an organization whose trial has ended opens a project
- **THEN** the metrics, leads and statistics stored before the end of the trial are shown

#### Scenario: Tariff assigned after trial
- **WHEN** the platform administrator assigns `BUSINESS` to that organization
- **THEN** its due integrations are claimed on the workers' next pass and their data catches up

#### Scenario: Trial that is still running
- **WHEN** an organization's `trialEndsAt` is in the future, or the organization is on a paid tariff
- **THEN** its jobs run as usual

#### Scenario: The notice
- **WHEN** an administrator of an organization whose trial has ended opens the app
- **THEN** the read-only notice says that data from integrations is no longer updated

### Requirement: The trial countdown sits in the same place on every page

The app header SHALL show the trial countdown, and after the end the ended notice, at the same position on every page of the organization area: between the header's left area and its toolbar, whether or not the page puts anything in that left area. Pages SHALL NOT move it.

#### Scenario: The countdown in Projects
- **WHEN** a member of an organization on a running trial opens Projects
- **THEN** the countdown is where it is in CRM, between the left area and the toolbar

#### Scenario: The ended notice in Projects
- **WHEN** a member of an organization whose trial has ended opens Projects
- **THEN** the ended notice is in the same place as the countdown was

### Requirement: A refusal for an ended trial raises a toast

When any request from the web app is refused because the trial ended, the answer being 403 with details `[{ code: "TRIAL_ENDED" }]`, the app SHALL raise one error toast saying in Russian that the trial has ended and changes are unavailable. It SHALL do so for every request the app sends, from any page and any form, whatever the page had been trying to change. While the toast is on screen, a further refusal SHALL NOT raise a second one, and the failure message the page itself would raise for the same request SHALL NOT appear beside it. A form that shows the refusal inline MAY keep doing so.

#### Scenario: Editing a task
- **WHEN** a member of an organization whose trial has ended moves a task to another column
- **THEN** one toast says the trial has ended, and the task returns to its column

#### Scenario: Another page
- **WHEN** the same member renames a project or edits a lead
- **THEN** the same toast appears

#### Scenario: Several refusals at once
- **WHEN** several requests are refused for the ended trial within a few seconds
- **THEN** one toast is on screen

#### Scenario: No second message
- **WHEN** a request is refused for the ended trial and its page would otherwise raise a generic failure toast
- **THEN** only the trial toast appears

#### Scenario: Other refusals
- **WHEN** a request is refused with 403 for another reason, such as a role or a tariff limit
- **THEN** no trial toast appears and the page handles the refusal as before
