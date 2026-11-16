# crm-navigation Specification

## Purpose
Give the CRM its own menu column, as Twenty's left menu, so a member moves between leads, organizations and people of the selected board's client without leaving the CRM.

## Requirements

### Requirement: The CRM has its own menu column

Every CRM page SHALL show a menu column on the left of the CRM content, beside the application's main menu. From the top, the column SHALL hold:
- The board picker, as the context. It follows the existing board selection rules: one board per project, with the client's name beside it.
- The sections Лиды, Организации and Люди. Each section shows how many leads the selected board holds, or how many organizations or people the board's client holds.

The section shown SHALL be marked as current. Choosing a section SHALL keep the selected board. On narrow screens the column SHALL collapse into a row of sections above the content.

#### Scenario: Moving to people
- **WHEN** a member on project Сайт's board chooses Люди
- **THEN** the people of Сайт's client are listed, Люди is marked current, and the board picker still names Сайт

#### Scenario: Changing the board from people
- **WHEN** a member viewing Люди picks the board of a project of another client
- **THEN** the list shows that other client's people

### Requirement: Each section has its own address

Лиды SHALL be at `/crm`, Организации at `/crm/companies` and Люди at `/crm/people`. The selected board SHALL be named in the address of each, so a reload or a shared link opens the same section and context. A record open in a side panel SHALL be named in the address as `record` on the organization and people pages, and as `lead` on the leads page. The main menu's CRM entry SHALL stay marked on all three pages.

#### Scenario: Reloading people with a person open
- **WHEN** a member reloads `/crm/people` with a board and a person named in the address
- **THEN** the people of that board's client are listed and the person's panel is open

### Requirement: The CRM can be scoped to one campaign

When the member's CRM by campaign preference is on, the CRM menu column SHALL show a campaign select directly under the board picker. It SHALL list the campaigns of the selected board's project and an option for all campaigns, which is selected by default. Choosing a campaign SHALL limit the leads shown on the board, in the table and in the tasks view, and the lead count of the section Лиды, to leads of that campaign. The choice SHALL be kept in the address and SHALL be cleared when the board changes. When the preference is off, the select SHALL NOT appear and no campaign scope SHALL apply, even if the address names one.

#### Scenario: Choosing a campaign
- **WHEN** a member with the preference on selects a campaign under the board picker
- **THEN** only that campaign's leads appear in the board, table and tasks views

#### Scenario: Returning to all campaigns
- **WHEN** the member picks the all campaigns option
- **THEN** every lead of the board is shown again

#### Scenario: Changing the board
- **WHEN** the member chooses another board while a campaign is selected
- **THEN** the campaign select shows all campaigns for the new board

#### Scenario: Preference off
- **WHEN** the preference is off
- **THEN** the CRM menu column has no campaign select
