## MODIFIED Requirements

### Requirement: The client's contact book adds a person or a partner

In the contact book of a client's cabinet, the company's people SHALL be shown on two tabs, «Сотрудники» and «Партнёры», whenever the reader may invite partners or the company has at least one partner. «Сотрудники» SHALL list the company's people who are not partners and have its own add button «Добавить». «Партнёры» SHALL list the company's partners only, each with the name of its campaign, and have its own add button «Добавить партнёра». A reader who may not invite partners and whose company has no partner SHALL see the staff list alone, without a tab bar.

«Добавить» SHALL open a dialog that invites somebody to the company, and SHALL NOT offer a choice of who to add. «Добавить партнёра» SHALL open a dialog that asks for a project of the client and then for a campaign of that project, SHALL refuse to create the invitation until a campaign is chosen, and SHALL show the registration link once the invitation exists. Each campaign SHALL be shown with a green mark when it is active or learning and a red one otherwise. A switch «Активные кампании» beside the campaign choice SHALL be on when the form opens and SHALL then offer active and learning campaigns only; turning it off SHALL offer every campaign of the project, and turning it back on SHALL clear a chosen campaign that is not running. A client's person who may invite but not invite partners SHALL see no «Добавить партнёра». The project page SHALL NOT contain partner management.

#### Scenario: Two tabs at once
- **WHEN** the `CLIENT_ADMIN` of Gealan opens the contact book
- **THEN** the tabs «Сотрудники» and «Партнёры» are shown before anything is pressed, each with its own list and its own add button

#### Scenario: The principal adds a partner
- **WHEN** the `CLIENT_ADMIN` of Gealan opens «Партнёры», presses «Добавить партнёра», chooses the project «Gealan Юг» and the campaign «Юг двери», and creates the invitation
- **THEN** a registration link for a partner of «Юг двери» is shown and can be copied

#### Scenario: Stopped campaigns
- **WHEN** «Gealan Юг» has two running campaigns and the paused «Старая акция»
- **THEN** the campaign choice offers the two running ones with a green mark, and offers «Старая акция» with a red mark only after «Активные кампании» is turned off

#### Scenario: No campaign chosen
- **WHEN** the principal presses «Добавить партнёра» and creates the invitation without a campaign
- **THEN** the dialog asks for a campaign and nothing is created

#### Scenario: Adding a person to the company
- **WHEN** the principal opens «Сотрудники», presses «Добавить» and creates the invitation
- **THEN** a company invitation is created, and the dialog never asked who to add

#### Scenario: A reader who may not invite partners
- **WHEN** a person of the company who may invite staff but not partners opens a contact book of a company without partners
- **THEN** they see the staff list and «Добавить», and no tab bar and no «Добавить партнёра»

#### Scenario: A reader who may not invite partners, in a company with partners
- **WHEN** that person opens the contact book of a company that has a partner
- **THEN** they see both tabs, the partner is listed on «Партнёры», and there is no «Добавить партнёра»

### Requirement: Partners are listed among the company's people and removed

The people of a client SHALL include the partners bound to campaigns of the client's projects, each with the campaign's name, and the people of one project SHALL include only that project's partners. The contact book SHALL list the partners on the tab «Партнёры» and SHALL NOT list them on «Сотрудники». The organization's `ADMIN` and the client's `CLIENT_ADMIN` SHALL remove a partner after confirming it, which ends that membership. A `CLIENT_ADMIN` SHALL NOT remove a member outside their own clients; such a request SHALL be answered as not found.

#### Scenario: The company's people
- **WHEN** the principal of Gealan opens «Партнёры»
- **THEN** a partner of «Окна Север» is listed with the role «Партнёр · Окна Север», and is not listed on «Сотрудники»

#### Scenario: Removing a partner
- **WHEN** the principal removes that partner and confirms
- **THEN** the partner can no longer sign in to the organization, and the company's other people are unaffected
