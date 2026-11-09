## ADDED Requirements

### Requirement: A tag in a lead's note is notified

A member tagged in a note on a lead, other than its author, SHALL receive a notification of kind LEAD_MENTIONED, which the bell SHALL show as Вас упомянули в заметке к лиду «name», and which Telegram SHALL send as Вас упомянули в заметке к лиду «name». Choosing it SHALL mark it read and open the CRM board of the lead's project with the lead's panel open. A member SHALL see it only while they reach the lead's project.

#### Scenario: The bell shows the mention
- **WHEN** a manager tags Борис in a note on lead Анна
- **THEN** Борис's bell lists Вас упомянули в заметке к лиду «Анна», and choosing it opens the lead

#### Scenario: Losing access
- **WHEN** a member whose access to the project was removed has an unread mention of a lead of that project
- **THEN** the notification is not listed to them
