Every implementation task follows TDD: add the focused failing test, observe it fail, then add the
minimum implementation.

## 1. Storing them

- [x] 1.1 Write the failing adapter tests for storing and reading a phone and a Telegram, and for both being absent.
- [x] 1.2 Add the columns with their migration, and carry them through the identity and member records.
- [x] 1.3 Write the failing HTTP tests for registering with them, without them, and for the profile update changing them.
- [x] 1.4 Accept them in the registration and profile schemas.
- [x] 1.5 Write the failing test proving nobody edits somebody else's.
- [x] 1.6 Run `npm test` — green.

## 2. Asking for them and showing them

- [x] 2.1 Write the failing tests for the three registration forms offering both fields and sending them.
- [x] 2.2 Add the fields to the forms.
- [x] 2.3 Write the failing tests for profile settings editing them.
- [x] 2.4 Add them to profile settings.
- [x] 2.5 Write the failing tests for the employee directory and the company team showing them, with a dash where one is missing.
- [x] 2.6 Show them in both, and add the Russian strings.
- [x] 2.7 Run `npm run test:web` — green.

## 3. Acceptance

- [x] 3.1 Update the README where it describes a person.
- [x] 3.2 Run `openspec validate add-personal-contact-details --strict`.
- [x] 3.3 Run `npm test`, `npm run test:web`, `npm run build`, `npm run build:web` — all green.
