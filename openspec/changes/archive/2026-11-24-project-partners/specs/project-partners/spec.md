## Purpose

Let a client give a partner access to one campaign of a project, and let the agency's admin and
the client's principal invite partners and remove them.

## ADDED Requirements

### Requirement: A partner invitation names one campaign

A registration type `PARTNER` SHALL exist beside the client, employee and client staff types. A
partner invitation SHALL name one campaign and SHALL carry no role, no projects and no client. The
organization's `ADMIN` SHALL issue it for any campaign, and a `CLIENT_ADMIN` only for campaigns of
their own client's projects; anyone else SHALL be refused with 403, and a campaign the issuer does
not reach SHALL be answered as not found. It SHALL follow the rules every invitation follows: it
may be bound to one email, may expire, may be revoked and is redeemed once. Its link SHALL open
the joining form, which asks for a name, a password and its confirmation, and an avatar, and for an
email only when the invitation is bound to none. Redeeming it SHALL create the account and a
membership of the organization with the role `PARTNER` bound to that campaign, all of it or none
of it. Several people MAY be bound to the same campaign.

#### Scenario: Inviting a partner
- **WHEN** the `CLIENT_ADMIN` of Gealan creates a partner invitation for the campaign «Окна Север»
- **THEN** a short link is returned and it opens the joining form

#### Scenario: Redeeming it
- **WHEN** a visitor completes the joining form from that link
- **THEN** an account exists with the role `PARTNER` bound to «Окна Север», the invitation is
  spent, and the visitor is taken to the sign-in form

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
With «Партнёр» it SHALL ask for a project of the client and then for a campaign of that project,
SHALL refuse to create the invitation until a campaign is chosen, and SHALL show the registration
link once the invitation exists. Each campaign SHALL be shown with a green mark when it is active
or learning and a red one otherwise. A switch «Активные кампании» beside the campaign choice SHALL
be on when the form opens and SHALL then offer active and learning campaigns only; turning it off
SHALL offer every campaign of the project, and turning it back on SHALL clear a chosen campaign
that is not running. A client's person who may invite but not invite partners SHALL
see no choice. The project page SHALL NOT contain partner management.

#### Scenario: The principal adds a partner
- **WHEN** the `CLIENT_ADMIN` of Gealan opens «Сотрудники», presses «Добавить», chooses «Партнёр»,
  the project «Gealan Юг» and the campaign «Юг двери», and creates the invitation
- **THEN** a registration link for a partner of «Юг двери» is shown and can be copied

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
each with the campaign's name, and the people of one project SHALL include only that project's
partners. The organization's `ADMIN` and the client's `CLIENT_ADMIN` SHALL remove a partner after
confirming it, which ends that membership. A `CLIENT_ADMIN` SHALL NOT remove a member outside their
own clients; such a request SHALL be answered as not found.

#### Scenario: The company's people
- **WHEN** the principal of Gealan opens «Сотрудники»
- **THEN** a partner of «Окна Север» is listed with the role «Партнёр · Окна Север»

#### Scenario: Removing a partner
- **WHEN** the principal removes that partner and confirms
- **THEN** the partner can no longer sign in to the organization, and the company's other people
  are unaffected

### Requirement: A deleted campaign ends its partners' access

Deleting a campaign SHALL end the memberships of the partners bound to it and SHALL make its
pending partner invitations stop working. The project's leads SHALL stay.

#### Scenario: A campaign removed from the project
- **WHEN** the campaign «Окна Север» is deleted while one partner is bound to it and one invitation
  is pending
- **THEN** the partner can no longer sign in, the invitation link no longer works, and the leads
  stay in the project
