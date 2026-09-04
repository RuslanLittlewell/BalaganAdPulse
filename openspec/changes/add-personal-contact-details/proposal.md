## Why

A person in this system has a name and an email. That is enough to sign in and not much
else: the agency's directory lists colleagues it cannot phone, and a client's company
lists people whose Telegram nobody knows. Both lists are read precisely when somebody
needs to reach somebody.

## What Changes

- A person carries a phone and a Telegram handle alongside their name and email.
- Every registration form asks for them, optionally — an account is not worth refusing
  over a missing phone number.
- Profile settings edit them, so they stay the person's own to keep current.
- The agency's employee directory and a client's company list both show them.

## Capabilities

### Modified Capabilities

- `organization-membership`: a person's record carries the ways of reaching them.

## Impact

- `apps/api`: `phone` and `telegram` on `User` and its migration; the fields through the
  member directory, the profile read and update, and the registration payload.
- `apps/web`: the three registration forms, profile settings, the employee directory and
  the company team.
