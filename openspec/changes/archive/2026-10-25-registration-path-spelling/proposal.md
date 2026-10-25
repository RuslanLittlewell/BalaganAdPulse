## Why

The registration link is spelled `/regustration/{code}`, in the page address, in the public API
route and in every link the backend hands out. It is a typo that clients see in the links they are
sent.

## What Changes

- The registration page moves to `/registration/:code` and the public lookup to
  `GET /api/registration/:code`; `registrationUrl` is `/registration/{code}`.
- Links already sent with `/regustration/:code` keep working: the page redirects them to the new
  address.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `registration-invitations`: the link's spelling, and old links redirecting.
- `contact-directory`: the copied link's spelling.

## Impact

- API: the resolver's mount, `registrationUrl` in invites and platform, OpenAPI, README.
- Web: the route, the redirect from the old path, the lookup's path.
