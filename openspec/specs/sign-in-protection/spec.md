# sign-in-protection Specification

## Purpose
Keep guessed passwords, forged cross-site requests and foreign WebSocket pages away from accounts, without telling anyone which logins exist.

## Requirements

### Requirement: Failed password attempts lock sign-in

The system SHALL count failed password attempts per account. Three failures in a row SHALL lock password sign-in for 15 minutes. After that lock ends, three more failures SHALL lock it for 30 minutes and SHALL then require a password reset: password sign-in SHALL stay refused, even with the right password, until the account sets a new password through a reset link, or an agency admin issues a new password for a client account. A successful sign-in SHALL clear the count. While sign-in is locked, a request with the right password SHALL be refused like a wrong one.

The count SHALL belong to the account whether its login or its email is typed. A login or email that belongs to no account SHALL be counted and locked the same way, so the answers never tell whether an account exists. The per-address limit on sign-in requests SHALL stay as it is.

A locked attempt SHALL answer 403 with details `[{ code: "SIGN_IN_LOCKED", until }]`, where `until` is when the lock ends, or `[{ code: "PASSWORD_RESET_REQUIRED" }]` once a reset is required. The sign-in form SHALL say in Russian that there were too many failed attempts and until when sign-in is locked, or that only a password reset opens it, and SHALL offer the «Забыли пароль?» link in both cases.

#### Scenario: Three failures
- **WHEN** someone types a wrong password for an account three times
- **THEN** the third answer is 403 with `SIGN_IN_LOCKED` and an `until` 15 minutes ahead, and the right password is refused until then

#### Scenario: The lock ends
- **WHEN** the 15 minutes have passed and the right password is typed
- **THEN** sign-in succeeds and the count is cleared

#### Scenario: Three more failures
- **WHEN** after the first lock three more wrong passwords are typed
- **THEN** the third answer is 403 with `PASSWORD_RESET_REQUIRED`, and sign-in with the right password stays refused after 30 minutes and later

#### Scenario: Reset opens sign-in
- **WHEN** the account sets a new password through a reset link
- **THEN** sign-in with the new password succeeds

#### Scenario: Login and email share a count
- **WHEN** two failures use the account's email and one uses its login
- **THEN** sign-in is locked

#### Scenario: An unknown login
- **WHEN** someone types a login that belongs to no account three times
- **THEN** the answers are the same as for an existing account

#### Scenario: The form
- **WHEN** the API answers a sign-in with `SIGN_IN_LOCKED`
- **THEN** the form says that sign-in is locked until the given time and shows the «Забыли пароль?» link

### Requirement: Cookie-authenticated writes come from the app itself

A `POST`, `PUT`, `PATCH` or `DELETE` request authenticated by the session cookie SHALL be refused with 403 when its `Origin` header names an origin other than the app's own, or when it has no `Origin` and its `Sec-Fetch-Site` header is `cross-site` or `same-site`. The app's own origin is the configured app address, or the request's own host. A request authenticated by an `Authorization` header SHALL NOT be checked, and neither SHALL reads.

#### Scenario: A write from a sibling site
- **WHEN** a page on another subdomain sends a cookie-authenticated `POST` to the API
- **THEN** the API responds 403 and changes nothing

#### Scenario: A write from the app
- **WHEN** the app sends the same request from its own origin
- **THEN** it succeeds

#### Scenario: A token in the header
- **WHEN** a script sends a write with a bearer token and a foreign `Origin`
- **THEN** the origin is not checked

### Requirement: Realtime connections come from the app itself

The realtime WebSocket SHALL refuse a connection whose `Origin` names another origin than the app's own, and SHALL refuse a message larger than 16 KB by closing the connection.

#### Scenario: A foreign page
- **WHEN** a page on another origin opens the realtime socket with the member's cookie
- **THEN** the upgrade is refused

#### Scenario: An oversized message
- **WHEN** a connected client sends a 1 MB message
- **THEN** the connection is closed
