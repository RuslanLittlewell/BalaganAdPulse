## Context

See `proposal.md`. `useMembers()` feeds five screens: the employee directory, the task
assignee select, and the three places a task shows who is responsible.

## Goals / Non-Goals

**Goals**

- A directory of one's colleagues.
- A project recognisable at a glance, and a removal that cannot happen by accident.

**Non-Goals**

- Hiding anybody from the API. The listing keeps answering with everybody.
- Hiding other admins. Only the reader is left out.

## Decisions

### The reader is filtered on the screen, not in the listing

Tempting to do it in the API — and wrong. The same listing is what the assignee select
reads, and somebody taking a task themselves is the ordinary case. Filtering there would
make it impossible to be made responsible for your own work, to fix a directory nobody
uses to find themselves.

So it is one line where the directory is drawn, and nowhere else.

### Confirmation before removing a grant, and none before adding one

They are not symmetrical. Granting a project shows somebody more than they saw; removing
one takes away work they may be in the middle of, and the rows are otherwise identical, so
a misplaced click is easy and its result is invisible until somebody complains.

## Risks / Trade-offs

- [An admin cannot see their own grants here] → They are an admin; their reach is the
  whole organization and there is nothing to read. A non-admin cannot change grants at all.

## Migration Plan

None. Presentation only.
