## RENAMED Requirements

- FROM: `### Requirement: A partner invitation names one campaign`
- TO: `### Requirement: A partner invitation names its campaigns`

## MODIFIED Requirements

### Requirement: A partner invitation names its campaigns

A registration type `PARTNER` SHALL exist beside the client, employee and client staff types. A
partner invitation SHALL name one or more campaigns, all of one project, and SHALL carry no role,
no projects and no client. The organization's `ADMIN` SHALL issue it for any campaigns, and a
`CLIENT_ADMIN` only for campaigns of their own client's projects; anyone else SHALL be refused with
403, a campaign the issuer does not reach SHALL be answered as not found, and campaigns of
different projects SHALL be refused. It SHALL follow the rules every invitation follows: it may be
bound to one email, may expire, may be revoked and is redeemed once. Its link SHALL open the
joining form, which asks for a name, a password and its confirmation, and an avatar, and for an
email only when the invitation is bound to none. Redeeming it SHALL create the account and a
membership of the organization with the role `PARTNER` bound to every campaign the invitation
names, all of it or none of it. Several people MAY be bound to the same campaign.

#### Scenario: Inviting a partner
- **WHEN** the `CLIENT_ADMIN` of Gealan creates a partner invitation for the campaigns «Окна Север» and «Окна Юг»
- **THEN** a short link is returned and it opens the joining form

#### Scenario: Redeeming it
- **WHEN** a visitor completes the joining form from that link
- **THEN** an account exists with the role `PARTNER` bound to «Окна Север» and «Окна Юг», the
  invitation is spent, and the visitor is taken to the sign-in form

#### Scenario: Campaigns of two projects
- **WHEN** an admin creates a partner invitation naming a campaign of «Gealan» and one of «Gealan Юг»
- **THEN** the request is refused and nothing is stored

#### Scenario: Another client's principal
- **WHEN** the `CLIENT_ADMIN` of another client creates an invitation naming «Окна Север»
- **THEN** the request is answered as not found and nothing is stored

#### Scenario: A manager
- **WHEN** an agency manager creates a partner invitation
- **THEN** the server responds 403

#### Scenario: A failure part-way
- **WHEN** any part of the redemption is refused
- **THEN** nothing is stored and the link still works

### Requirement: The client's contact book adds a person or a partner

In the contact book of a client's cabinet, the directory of the company's people SHALL be named
«Сотрудники», its add button SHALL be named «Добавить», and there SHALL be no Partners tab. The
dialog the button opens SHALL offer the choice «Сотрудник» or «Партнёр» to those who may invite
partners. With «Сотрудник» the dialog SHALL work as before and invite somebody to the company.
With «Партнёр» it SHALL ask for a project of the client, then offer the project's advertising
accounts and its campaigns, each as a multi-select. An advertising account SHALL be shown by its
channel and account ID, and campaigns added by hand SHALL form one more choice of their own.
Every account SHALL be chosen when a project is chosen; the campaign list SHALL offer only
campaigns of the chosen accounts, and unchoosing an account SHALL unchoose its campaigns. The
dialog SHALL refuse to create the invitation until at least one campaign is chosen, and SHALL show
the registration link once the invitation exists. Each campaign SHALL be shown with a green mark
when it is active or learning and a red one otherwise. A switch «Активные кампании» beside the
campaign choice SHALL be on when the form opens and SHALL then offer active and learning campaigns
only; turning it off SHALL offer every campaign of the chosen accounts, and turning it back on
SHALL unchoose campaigns that are not running. A client's person who may invite but not invite
partners SHALL see no choice. The project page SHALL NOT contain partner management.

#### Scenario: The principal adds a partner
- **WHEN** the `CLIENT_ADMIN` of Gealan opens «Сотрудники», presses «Добавить», chooses «Партнёр»,
  the project «Gealan Юг» and the campaigns «Юг двери» and «Юг окна», and creates the invitation
- **THEN** a registration link for a partner of both campaigns is shown and can be copied

#### Scenario: Narrowing by account
- **WHEN** «Gealan Юг» runs campaigns in a Meta account and a Google Ads account and the principal
  unchooses the Google Ads account
- **THEN** the campaign list offers only the Meta campaigns, and a Google Ads campaign chosen
  before is no longer chosen

#### Scenario: Stopped campaigns
- **WHEN** «Gealan Юг» has two running campaigns and the paused «Старая акция»
- **THEN** the campaign choice offers the two running ones with a green mark, and offers
  «Старая акция» with a red mark only after «Активные кампании» is turned off

#### Scenario: No campaign chosen
- **WHEN** the principal chooses «Партнёр» and creates the invitation without a campaign
- **THEN** the dialog asks for a campaign and nothing is created

#### Scenario: Adding a person to the company
- **WHEN** the principal presses «Добавить», keeps «Сотрудник» and creates the invitation
- **THEN** a company invitation is created as before

### Requirement: Partners are listed among the company's people and removed

The people of a client SHALL include the partners bound to campaigns of the client's projects,
each with the names of their campaigns, and the people of one project SHALL include only that
project's partners. The organization's `ADMIN` and the client's `CLIENT_ADMIN` SHALL remove a
partner after confirming it, which ends that membership. A `CLIENT_ADMIN` SHALL NOT remove a member
outside their own clients; such a request SHALL be answered as not found.

#### Scenario: The company's people
- **WHEN** the principal of Gealan opens «Сотрудники»
- **THEN** a partner of «Окна Север» and «Окна Юг» is listed with the role
  «Партнёр · Окна Север, Окна Юг»

#### Scenario: Removing a partner
- **WHEN** the principal removes that partner and confirms
- **THEN** the partner can no longer sign in to the organization, and the company's other people
  are unaffected

### Requirement: A deleted campaign ends its partners' access

Deleting a campaign SHALL take it from the partners and the pending partner invitations that name
it. A partner left with no campaign SHALL no longer sign in, and an invitation left with no
campaign SHALL stop working. A partner who keeps another campaign SHALL keep reaching it. The
project's leads SHALL stay.

#### Scenario: A campaign removed from the project
- **WHEN** the campaign «Окна Север» is deleted while one partner is bound to it alone and one
  invitation naming only it is pending
- **THEN** the partner can no longer sign in, the invitation link no longer works, and the leads
  stay in the project

#### Scenario: A partner with another campaign
- **WHEN** «Окна Север» is deleted while a partner is bound to it and to «Окна Юг»
- **THEN** the partner still signs in and reaches «Окна Юг» and its leads
