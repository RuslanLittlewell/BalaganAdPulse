## Why

The landing's contact form opens a mail draft and collects no contact details, so the lead intake script on the page has nothing to send and the agency cannot answer a visitor who closes the mail program.

## What Changes

- The contact form gains a required email field and an optional phone field.
- The mail draft includes both values.
- The page loads the lead intake script, so a submission with a valid email also reaches the CRM.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `public-landing`: the contact form fields and the intake script.

## Impact

The landing footer, the site constants and the landing tests.
