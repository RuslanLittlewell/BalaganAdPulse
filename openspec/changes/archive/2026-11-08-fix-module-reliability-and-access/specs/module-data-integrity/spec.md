## Purpose

Protect currently authorized information and preserve user work through failed saves, concurrent editing, session transitions, and repeated actions.

## ADDED Requirements

### Requirement: Notifications follow current resource access

Notification lists, unread counts, read actions and stream deliveries SHALL expose only resources the recipient can currently read. Revoked project access, task visibility, membership suspension and organization suspension SHALL be respected.

#### Scenario: Access is revoked
- **WHEN** a manager loses project access and the project is renamed
- **THEN** old notifications do not disclose its new name and are excluded from unread counts

### Requirement: Password changes replace refresh sessions

Changing a password SHALL atomically revoke previous refresh sessions and issue a replacement session for the current device. Previous refresh tokens SHALL be refused. Existing access tokens retain their configured expiry.

#### Scenario: An old device tries to renew
- **WHEN** a password has changed and an earlier device submits its old refresh token
- **THEN** renewal is rejected while the replacement session can renew

### Requirement: Document drafts survive unsuccessful saves

Failed or queued document edits SHALL remain dirty until acknowledged. A saved indicator SHALL appear only when no newer dirty edits remain. Drafts SHALL be recoverable after reload or closing and scoped to their user and document. Page departure SHALL persist dirty work. The editor SHALL offer retry after transient failure and explicit resolution after a revision conflict.

#### Scenario: Content fails and a title changes
- **WHEN** saving content fails and the member subsequently changes the title
- **THEN** the next save includes unsaved content and the new title

#### Scenario: The browser reloads
- **WHEN** a member reloads with unsaved document changes
- **THEN** reopening the document restores those changes for that member

### Requirement: Session transitions isolate outstanding requests

A response from an earlier session SHALL NOT replace the current user's context. Temporary bootstrap failures SHALL retain the session and offer retry. Definitive authentication failures SHALL clear it.

#### Scenario: An old response arrives late
- **WHEN** a user signs out, another signs in, and the first session load completes
- **THEN** the second user's identity and access context remain current

### Requirement: Task form submissions are exclusive while saving

The task form SHALL ignore repeated submissions while a save is pending and disable its submit controls until the operation settles. Failure SHALL preserve the draft and allow retry.

#### Scenario: The create button is pressed twice
- **WHEN** the first create is waiting for a response and the member submits again
- **THEN** exactly one create request is sent

### Requirement: Media views release object URLs

Creative and report-cover views SHALL release their object URLs when replaced or unmounted. Cached media bytes SHALL have finite retention and be cleared with the session cache.

#### Scenario: A media preview closes
- **WHEN** the last view using a creative or cover closes
- **THEN** its view URL is revoked and cached bytes remain only for the bounded retention period
