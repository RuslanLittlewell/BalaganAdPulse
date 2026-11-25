## ADDED Requirements

### Requirement: A Marquiz quiz sends leads by webhook

A public endpoint SHALL accept a Marquiz webhook at an address that carries the project's website
key, and SHALL create a lead from it under the rules of the intake endpoint: in the project's
first column, with the website origin, with the contact person and company linked or created, and
with the board change announced. The lead SHALL take the name, phone and email from the quiz
contacts, keep every answered quiz question as a question and answer pair with a trailing
required mark removed from the question, keep the quiz name as one more pair, and keep the UTM
tags, the page address and the referrer the submission carries. A question answered with several
options SHALL keep all of them. The lead SHALL be linked to a campaign by `utm_campaign` like any
website lead. The webhook comes from Marquiz's servers rather than a visitor's browser, so it
SHALL be accepted whatever the key's list of allowed sites holds. The same submission delivered
again SHALL NOT create a second lead. A request with an unknown or rotated key SHALL be refused
without creating a lead or revealing whether a project exists. A body that is not JSON, or that
carries neither contacts nor answers, SHALL be refused without creating a lead. The per-key limit
and the body size cap of the intake endpoint SHALL apply.

The CRM integrations window SHALL have a Marquiz tab beside the web integration for members who
may manage the website key. The tab SHALL show the webhook address with the project's key, a copy
button, a short instruction for the quiz editor and a note that the address changes when the key
is replaced. When the project has no key, the tab SHALL offer to create it.

#### Scenario: A quiz submission
- **WHEN** Marquiz posts a submission with a name, a phone, an email, three answers, the quiz name and `utm_campaign=spring` to the project's webhook address
- **THEN** a lead with that name appears in the first column with the website origin, its contact holds the phone and email, its card lists the three answers and the quiz name, and it carries `utm_campaign=spring`

#### Scenario: Linking to a campaign
- **WHEN** the submission's `utm_campaign` equals the name of one of the project's campaigns
- **THEN** the lead is linked to that campaign

#### Scenario: A delivery repeated
- **WHEN** Marquiz delivers the same submission twice
- **THEN** one lead exists

#### Scenario: No allowed sites
- **WHEN** the key's list of allowed sites is empty and Marquiz posts a submission
- **THEN** the lead is created

#### Scenario: A rotated key
- **WHEN** a submission arrives at the address of a key that was rotated
- **THEN** it is refused and no lead is created

#### Scenario: Not a quiz submission
- **WHEN** the body is not JSON, or holds neither contacts nor answers
- **THEN** it is refused and no lead is created

#### Scenario: The Marquiz tab
- **WHEN** a manager opens the Marquiz tab of the CRM integrations window for a project with a key
- **THEN** the tab shows the webhook address with the key, a button that copies it and where to paste it in the quiz editor

#### Scenario: A project without a key
- **WHEN** a manager opens the Marquiz tab for a project without a key and creates the key there
- **THEN** the tab shows the webhook address with the new key
