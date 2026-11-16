## Why

The landing loads the lead intake script, which sends leads to the application host. The landing's content security policy only allows requests to its own host, so the browser blocks every lead before it leaves the page and nothing reaches the CRM.

## What Changes

- The landing's content security policy lets the page send requests to the application's origin, and nowhere else.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `public-landing`: the policy allows connections to the application origin.

## Impact

The landing host middleware and its test.
