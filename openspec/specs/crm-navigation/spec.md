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
