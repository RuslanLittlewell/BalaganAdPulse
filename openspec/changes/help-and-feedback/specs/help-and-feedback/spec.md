## Purpose

Lets every member of an organization reach support from inside the app: send a problem,
an idea or a question with the context support needs.

## ADDED Requirements

### Requirement: The left menu opens help and feedback

The organization's left menu SHALL end with a "Помощь" item below the sections, for every
member whatever the role. Choosing it SHALL open the help and feedback dialog. When the
menu is collapsed the item SHALL show only its icon, with "Помощь" as its accessible name
and tooltip. The platform administrator's menu SHALL NOT have the item.

#### Scenario: Member opens help
- **WHEN** a member of any role chooses "Помощь" in the left menu
- **THEN** the dialog "Помощь и обратная связь" opens

#### Scenario: Collapsed menu
- **WHEN** the menu is collapsed
- **THEN** the item shows its icon only and is still reachable by the name "Помощь"

#### Scenario: Platform administrator
- **WHEN** the platform administrator opens the platform area
- **THEN** its menu has no "Помощь" item

### Requirement: Feedback has one of six topics

The feedback form SHALL offer these topics, in this order, with the first chosen when the
dialog opens: `PROBLEM` "Сообщить о проблеме", `IMPROVEMENT` "Предложить улучшение",
`QUESTION` "Вопрос по работе сервиса", `TARIFF` "Тариф и оплата", `AD_ACCOUNTS`
"Подключение рекламных кабинетов", `OTHER` "Другое". The API SHALL refuse any other topic
with 400.

#### Scenario: Default topic
- **WHEN** the dialog opens
- **THEN** "Сообщить о проблеме" is chosen

#### Scenario: Unknown topic
- **WHEN** `POST /api/support/feedback` carries the topic `BILLING`
- **THEN** the API responds 400 and sends nothing

### Requirement: Feedback carries a message and up to three screenshots

The message SHALL be required and SHALL hold at most 5000 characters after trimming. The
person SHALL be able to attach up to three PNG, JPEG or WebP images of at most 5 MB each,
by choosing files, by dropping them on the form or by pasting an image from the clipboard,
and SHALL be able to remove an attached image before sending. The API SHALL refuse an
empty or too long message, a fourth image, a file of another type or a file over the size
with 400 and send nothing.

#### Scenario: Empty message
- **WHEN** the person sends the form with only spaces in the message
- **THEN** the form names the missing message and nothing is sent

#### Scenario: Pasted screenshot
- **WHEN** the person pastes an image while the form is open
- **THEN** the image is attached and shown as a thumbnail with a button to remove it

#### Scenario: Fourth image
- **WHEN** three images are attached
- **THEN** the form accepts no further image

#### Scenario: Wrong file type
- **WHEN** the request carries a PDF as a screenshot
- **THEN** the API responds 400 and sends nothing

### Requirement: Feedback carries technical context

The form SHALL send, with the message, the page path, the browser's user agent and the
screen size. The API SHALL add the organization, the person's name, email or login, their
role and the tariff from the session, so the client cannot forge them.

#### Scenario: Context in the email
- **WHEN** a manager of "Acme" sends a problem from `/projects/42`
- **THEN** the email names the page `/projects/42`, the browser, the screen size, the
  organization "Acme", the manager's name and email, the role `MANAGER` and the tariff

#### Scenario: Forged organization
- **WHEN** the request body names another organization
- **THEN** the email names the sender's own organization

### Requirement: Feedback is delivered as an email to support

`POST /api/support/feedback` SHALL send one email to `SUPPORT_EMAIL` through the
configured mail transport and answer 202 once the transport has accepted it. The subject
SHALL name the topic and the organization. The screenshots SHALL be attachments. When the
sender has an email address it SHALL be the reply-to address. Nothing SHALL be stored in
the database. When `SUPPORT_EMAIL` or the mail transport is not configured, or the
transport fails, the API SHALL answer 503 and the form SHALL keep the message and offer
the support email instead.

#### Scenario: Problem with a screenshot
- **WHEN** a member sends "Сообщить о проблеме" with one screenshot
- **THEN** support receives one email whose subject names the topic and the organization,
  with the screenshot attached and the member's email as the reply-to address

#### Scenario: Sender without an email
- **WHEN** a client who signs in with a login and has no email sends feedback
- **THEN** the email names the login and carries no reply-to address

#### Scenario: Mail not configured
- **WHEN** `SUPPORT_EMAIL` is unset and a member sends feedback
- **THEN** the API responds 503 and the form keeps the message

#### Scenario: Sent
- **WHEN** the API answers 202
- **THEN** the form is replaced by a thank-you that says where the answer will come

### Requirement: Feedback is open to every member and limited in rate

Every active member of an active organization, of any role, SHALL be able to send
feedback, including while the organization's trial has ended. A signed-out caller SHALL
get 401, and the platform administrator and a member of a suspended organization SHALL
get 403. One person SHALL be able to send at most five messages in ten minutes; the next
SHALL answer 429.

#### Scenario: Expired trial
- **WHEN** a member of an organization whose trial has ended sends feedback
- **THEN** the API responds 202

#### Scenario: Client role
- **WHEN** a member with the `CLIENT` role sends feedback
- **THEN** the API responds 202

#### Scenario: Sixth message
- **WHEN** a person sends a sixth message within ten minutes
- **THEN** the API responds 429 and sends nothing

### Requirement: The dialog points to the support email when feedback fails

`GET /api/support/contacts` SHALL return, to any active member, the support email from
`SUPPORT_EMAIL` and whether feedback can be sent. The dialog SHALL show the email only
when writing through the form does not work: as a `mailto:` link in the notice that
replaces the form when feedback cannot be sent, and after a failed send. When no email is
set the notice SHALL say that writing to support is unavailable. Beside a working form the
dialog SHALL show no contacts and no further help.

#### Scenario: Form works
- **WHEN** feedback can be sent
- **THEN** the dialog shows the form and no support email

#### Scenario: Mail transport down
- **WHEN** `SUPPORT_EMAIL` is `balagan.ads@gmail.com` but feedback cannot be sent
- **THEN** the form is replaced by a notice that links to `mailto:balagan.ads@gmail.com`

#### Scenario: Send fails
- **WHEN** the API answers 503 to a message
- **THEN** the form keeps the message and its error links to the support email

#### Scenario: Nothing configured
- **WHEN** `SUPPORT_EMAIL` is unset
- **THEN** the dialog shows no contact and a notice that writing to support is unavailable
