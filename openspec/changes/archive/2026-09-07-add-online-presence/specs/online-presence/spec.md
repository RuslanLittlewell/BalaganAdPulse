## Purpose

Shows every member who else is working in the system right now, so that a question
can be addressed to somebody who is actually at their desk, and keeps that picture
current without anyone having to ask for it.

## ADDED Requirements

### Requirement: Presence follows authenticated activity

The system SHALL treat a person as online while their organization has seen an
authenticated request from them within the last five minutes, and SHALL record that
moment on every authenticated request regardless of which endpoint it reached. A
session that repeats `GET /api/auth/me` SHALL therefore stay online for as long as it
keeps repeating it.

Presence SHALL be held per person, not per session: a person working in several tabs
or on several devices SHALL appear once, and SHALL remain online while any of their
sessions is still active.

An unauthenticated request SHALL NOT make anybody online.

#### Scenario: A request marks its caller online

- **WHEN** a member issues an authenticated request
- **THEN** that member is online

#### Scenario: Silence ends presence

- **WHEN** five minutes pass without any authenticated request from a member
- **THEN** that member is no longer online

#### Scenario: One entry per person

- **WHEN** a member has two sessions open and only one of them is still issuing requests
- **THEN** that member appears once in the roster
- **AND** remains online

#### Scenario: Anonymous traffic is not presence

- **WHEN** a request arrives without valid credentials
- **THEN** nobody becomes online because of it

### Requirement: Signing out ends presence at once

The system SHALL remove a person from the roster when they sign out, without waiting
for their activity window to expire.

#### Scenario: Sign-out removes the avatar

- **WHEN** a member signs out
- **THEN** they leave the roster immediately
- **AND** the people who could see them are told they left

### Requirement: The roster is scoped to the viewer

The system SHALL disclose an online person to a viewer only when the viewer is
entitled to know of them. A viewer SHALL never see anybody from another organization.

Within an organization, a staff member SHALL see everyone online. A customer SHALL see
online staff and online people belonging to the client companies they themselves
belong to, and SHALL NOT see people of any other client company.

#### Scenario: Organization boundary

- **WHEN** a member of another organization is online
- **THEN** they do not appear in the viewer's roster

#### Scenario: Staff see the whole organization

- **WHEN** a staff member views the roster
- **THEN** it holds every person online in their organization

#### Scenario: A customer does not see another client's people

- **WHEN** a customer views the roster
- **AND** somebody from a different client company is online
- **THEN** that person does not appear
- **AND** online staff still do

### Requirement: The roster reaches an open session over the realtime connection

The system SHALL send the current roster to a session as soon as its realtime
connection is established, and SHALL afterwards send a message when somebody joins the
roster and when somebody leaves it, so that an open session stays current without
polling. Each message SHALL be filtered for the receiving session by the scoping rule
above.

An entry SHALL carry what the interface needs to draw the person: their identity, their
display name, and whether they have an avatar.

#### Scenario: The roster arrives on connect

- **WHEN** a session opens its realtime connection
- **THEN** it receives the roster of everyone currently online that it may see

#### Scenario: A newcomer is announced

- **WHEN** somebody becomes online
- **THEN** every session entitled to see them receives a message naming them

#### Scenario: A departure is announced

- **WHEN** somebody stops being online
- **THEN** every session that could see them receives a message that they left

#### Scenario: A withheld person is never announced

- **WHEN** somebody becomes online whom a session may not see
- **THEN** that session receives nothing about them

### Requirement: The header shows who is online

The interface SHALL show the online roster in the application header, between the
header's action buttons and the current user's own block, as avatars alone. Hovering an
avatar SHALL reveal that person's name.

The viewer SHALL NOT appear in their own roster. When more people are online than the
header shows avatars for, the surplus SHALL be summarized as a count rather than
widening the header. When nobody else is online, the block SHALL occupy no space.

#### Scenario: Avatars stand in for names

- **WHEN** other people are online
- **THEN** the header shows an avatar for each of them and no names

#### Scenario: A name appears on hover

- **WHEN** the viewer hovers an avatar
- **THEN** that person's name is shown

#### Scenario: The viewer is left out

- **WHEN** the viewer is online, as they must be to see the header
- **THEN** their own avatar is not among the online avatars

#### Scenario: A crowd is summarized

- **WHEN** more people are online than the header shows avatars for
- **THEN** the ones beyond that are represented by a count of the remainder

#### Scenario: Nobody else online

- **WHEN** no one else is online
- **THEN** the block shows nothing
