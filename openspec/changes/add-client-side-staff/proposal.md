## Why

A customer is one person. Their marketing lead, their accountant and whoever actually
approves the creatives all share the one account and the one password, or they do not get
in at all.

The agency's own directory has just been corrected to leave customers out of it — the
employee list is admins, managers and guests, the people the agency invited. The other
half of that statement has nowhere to live yet: a client's people belong to the client,
and there is no way to add them.

## What Changes

- A client has its own people. Each holds a membership reaching that client and nothing
  else, exactly as the client's own account does.
- Two levels on the customer's side: the person who registered the company administers
  its people; everybody else the client adds only reads.
- **Both sides can invite them**: the client's principal for their own company, and an
  agency admin on their behalf.
- An invitation gains a third kind — joining an existing client, rather than creating one.
- A client's employee sees what the client sees: the projects, the figures, and the tasks
  marked as shown to the client.
- **BREAKING**: the account created by a client registration becomes the client's
  principal rather than an ordinary customer. Existing client accounts are migrated to it,
  since each is currently the only person on its client.

## Capabilities

### Modified Capabilities

- `access-control`: a second customer role, reaching one client and administering its people.
- `registration-invitations`: invitations that add somebody to an existing client, issued
  by either side.
- `contact-directory`: a client's own people, listed under the client.
- `task-board`: the customer visibility rule covers both customer roles.

## Impact

- `packages/access-policy`: a `CLIENT_ADMIN` role and its row in the matrix.
- `apps/api`: the role in the schema and its migration; a `CLIENT_STAFF` registration type
  carrying the client it joins; invitation reach for a customer issuing one; the
  visibility rule and the staff listing widened to both customer roles.
- `apps/web`: the client's own directory, the invitation control on both sides, and the
  registration form for joining a client.
