## Context

See `proposal.md`. `PUT /api/members/:id/access` replaces a membership's grants wholesale
and answers with what it stored; nothing reads them. A grant names a client and,
optionally, one of its projects — naming the client alone means every project of it.

## Goals / Non-Goals

**Goals**

- One screen that answers "what can this person reach" and lets an admin change it.
- Invitations listed where one is made rather than under the people.

**Non-Goals**

- Changing what a grant is, or how it is enforced. Reach is unchanged.
- Client-wide grants in the interface. The directory adds and removes *projects*; a grant
  covering a whole client is still stored and shown, and is made where clients are.

## Decisions

### A read endpoint rather than grants on the listing

`GET /api/members/:id/access`, beside the `PUT` that already exists. Putting grants on
the member listing would join them for every row of a screen that shows one at a time,
and would make the common read pay for the rare one.

### The interface adds and removes projects, and the endpoint still replaces

The endpoint's contract is "these are the grants now", which is the right shape for a
screen that edits a set. The directory reads the current set, applies one change, and
sends the whole thing back — so two admins editing at once cannot merge into something
neither chose; the later write wins entirely, which is at least a state somebody picked.

### A client-wide grant is shown but not editable here

A grant naming a client and no project means every project of that client. The directory
shows it as such and does not offer to remove it: doing so would change what the person
reaches across a whole client from a screen about one project at a time. It stays where
client access is decided.

### Invitations move into the dialog rather than being removed

They were under the directory, competing with the person being read. In the dialog they
sit beside the control that makes one, which is when somebody wants to know what is
already outstanding.

## Risks / Trade-offs

- [Replacing the whole set loses a concurrent edit] → Stated above: the later write wins
  entirely rather than merging into a state neither admin chose. Two admins editing one
  person's access at the same moment is rare enough to prefer the simpler contract.
- [A minimum height wastes space on a short list] → It buys a book that does not resize
  as one clicks through people, which is the thing being read.

## Migration Plan

No schema and no data. The new endpoint is additive.
