# first-login-onboarding Specification

## Purpose
Brings a member from their first visit to the point where the app is useful: a welcome
that says what the app is for, and a short list of first steps that tracks itself.

## Requirements

### Requirement: A member is welcomed on the first visit

The first time a member opens the app in an organization, a welcome dialog SHALL appear,
whatever page they land on. Its text SHALL depend on the role: `ADMIN`, `MANAGER`, `GUEST`,
or `CLIENT` and `CLIENT_ADMIN` alike. Closing it in any way SHALL record that the member
has been welcomed, and it SHALL NOT appear again for that membership on any device. For
an `ADMIN` or a `MANAGER` with steps left, the dialog's main button SHALL open the
first-steps list. The platform administrator SHALL never see it.

#### Scenario: New organization's admin
- **WHEN** the first admin of a new organization signs in for the first time
- **THEN** the welcome for an admin appears, and its button opens the first-steps list

#### Scenario: Invited client
- **WHEN** a client invited into an organization opens the app for the first time
- **THEN** the welcome for a client appears, with a button that only closes it

#### Scenario: Second device
- **WHEN** a member closed the welcome on a laptop and then signs in on a phone
- **THEN** the welcome does not appear

#### Scenario: Member who existed before
- **WHEN** a member who joined before this capability shipped opens the app
- **THEN** no welcome appears

### Requirement: Admins and managers have a list of first steps

An `ADMIN` or a `MANAGER` SHALL see a "Первые шаги" item in the left menu, above
"Помощь", with how many steps are done out of how many, while they have steps left and
have not hidden the list. Choosing it SHALL open the list. Each step SHALL show its title,
one line on why it matters, and whether it is done. `GUEST`, `CLIENT` and `CLIENT_ADMIN`
SHALL have no list. While steps are left the item SHALL stand out from the other menu
items and pulse gently, without the pulse for a person who prefers reduced motion. The
item SHALL be shown on wide screens only; the mobile bottom bar SHALL keep its sections and
"Помощь".

#### Scenario: Progress in the menu
- **WHEN** an admin has done two of six steps
- **THEN** the menu shows "Первые шаги" with "2 из 6"

#### Scenario: Attention
- **WHEN** an admin has steps left
- **THEN** the "Первые шаги" item stands out and pulses

#### Scenario: Guest
- **WHEN** a guest opens the app
- **THEN** the menu has no "Первые шаги" item

#### Scenario: Collapsed menu
- **WHEN** the menu is collapsed
- **THEN** the item shows an icon and is reachable by the name "Первые шаги"

### Requirement: An admin's steps follow the organization's data

An `ADMIN`'s list SHALL hold these steps in this order, each done under its condition:

| Step | Done when |
| --- | --- |
| Добавить клиента | the organization has a client |
| Создать проект | the organization has a project |
| Подключить рекламный кабинет | a project of the organization has a Meta or Google connection |
| Пригласить сотрудника | the organization has another active `ADMIN`, `MANAGER` or `GUEST`, or a pending invitation for an employee |
| Задать цель KPI | the organization has a KPI target |
| Подключить Telegram-бота | the admin's own Telegram is linked to the bot |

The employee step SHALL be left out when the tariff allows one user. The Telegram step
SHALL be left out when the bot is not offered to the person, as the Telegram bot
capability decides. A step done by anyone, anywhere in the app, SHALL show as done the
next time the list is read, and the count in the menu SHALL follow within one minute or on
the next change the person makes.

#### Scenario: Client added from the contact book
- **WHEN** an admin adds a client through the contact book without opening the list
- **THEN** "Добавить клиента" shows as done

#### Scenario: Another admin connects an account
- **WHEN** a second admin connects a Meta account to a project
- **THEN** the first admin's "Подключить рекламный кабинет" shows as done

#### Scenario: Solo tariff
- **WHEN** the organization is on a tariff that allows one user
- **THEN** the list has no "Пригласить сотрудника"

#### Scenario: Bot not configured
- **WHEN** the server has no Telegram bot
- **THEN** the list has no "Подключить Telegram-бота"

### Requirement: A manager's steps follow their own data

A `MANAGER`'s list SHALL hold "Заполнить профиль", done when the person has a phone or a
Telegram name in the profile, and "Подключить Telegram-бота", done and left out under the
same conditions as for an admin.

#### Scenario: Profile filled in
- **WHEN** a manager saves a phone number in the profile
- **THEN** "Заполнить профиль" shows as done

### Requirement: Steps are taken in order and lead to where they are done

Only the first step that is not done SHALL be open. Every later step that is not done
SHALL be locked, show "Сначала выполните предыдущий шаг" in place of its description, and
not react. A step the data shows as done SHALL show as done wherever it stands in the list,
also when it was done out of order. Choosing the open step SHALL close the list and take
the person to the place where it is done:

| Step | Leads to |
| --- | --- |
| Добавить клиента | the contact book, on clients |
| Создать проект | the project list |
| Подключить рекламный кабинет | the page of the organization's first project, or the project list when there is none |
| Пригласить сотрудника | the contact book, on employees |
| Задать цель KPI | the dashboard |
| Подключить Telegram-бота | the task board |
| Заполнить профиль | the profile settings |

A step that is done SHALL show as done and SHALL NOT lead anywhere.

#### Scenario: Later steps locked
- **WHEN** an admin has added a client and nothing else
- **THEN** only "Создать проект" can be chosen, and the steps after it are locked

#### Scenario: Done out of order
- **WHEN** an employee has been invited before any client was added
- **THEN** "Пригласить сотрудника" shows as done and "Добавить клиента" is the open step

#### Scenario: Add a client
- **WHEN** an admin chooses "Добавить клиента"
- **THEN** the contact book opens on clients

#### Scenario: Connect an account with a project
- **WHEN** an admin with a client and one project chooses "Подключить рекламный кабинет"
- **THEN** that project's page opens

### Requirement: The list can be skipped and ends on its own

The list SHALL offer "Пропустить". Skipping SHALL remove the menu item for that membership
on every device for good. Closing the list in any other way SHALL keep the item in the
menu. When every step of the list is done, the item SHALL disappear on its own. The welcome and the list SHALL keep working while the organization's trial has
ended, so far as reading and hiding go.

#### Scenario: Skip
- **WHEN** an admin chooses "Пропустить" in the list
- **THEN** the item leaves the menu and does not return after signing in elsewhere

#### Scenario: Closed without skipping
- **WHEN** an admin closes the list with Escape
- **THEN** the item stays in the menu

#### Scenario: Everything done
- **WHEN** the last step of a manager's list is done
- **THEN** the item leaves the menu

### Requirement: The onboarding state is read and changed through the API

`GET /api/onboarding` SHALL return, for the calling member, whether they have been
welcomed, whether the list is hidden, and the steps with whether each is done, plus the id
of the organization's first project when there is one. `POST /api/onboarding/welcome` and
`POST /api/onboarding/hide` SHALL record the welcome and the hiding for the calling
membership and answer 204, also after the trial has ended. A signed-out caller SHALL get
401; the platform administrator and a member of a suspended organization SHALL get 403.

#### Scenario: Welcome recorded
- **WHEN** a member calls `POST /api/onboarding/welcome`
- **THEN** `GET /api/onboarding` reports them as welcomed

#### Scenario: Expired trial
- **WHEN** an admin of an organization whose trial has ended calls `POST /api/onboarding/hide`
- **THEN** the API responds 204
