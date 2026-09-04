## Context

See `proposal.md` for motivation. `link-tasks-to-campaigns` gave a task an optional
campaign of its own project. The board owns managing work; the project and campaign
screens own reading figures. This change puts a read-only slice of the board on those
two screens.

The description is a ProseMirror document rendered by TipTap with a custom image node
that fetches bytes with the member's token. Anything that renders a description has to
use the same extensions, or a description containing an image renders as nothing.

## Goals / Non-Goals

**Goals**

- One list component serving both screens, differing only in what it is given.
- A read-only view that cannot drift from the editor's rendering of the same document.
- No new way to change a task.

**Non-Goals**

- Editing, moving, creating or deleting from these screens. The board does that.
- A task count on the campaign table, or filtering the board by campaign.
- Pagination. A project's in-flight work and a campaign's work are both small enough
  to read whole; when that stops being true it will be visible as a long list, which is
  a better signal than a page control nobody needed.

## Decisions

### In flight means the four stages that are not done or archived

`IDEA`, `IN_PROGRESS`, `NEEDS_FIX`, `IN_REVIEW`. Stated once, in the task entity, as the
complement of the two terminal columns — so a column added later is in flight by default,
which is the safe direction: a new stage appearing in the list is noticed, one silently
missing from it is not.

The campaign list is deliberately *not* filtered this way. A campaign's whole task
history is a handful of rows and part of what the campaign is; a project's is not.

### Filtering by campaign happens on the server, filtering by stage on the client

The campaign filter is a query parameter, because "the tasks of this campaign" is a
listing whose size does not grow with the project's history.

The stage filter is applied where the list is drawn, because the project screen asks for
the same listing the board already asks for — the project's tasks — and reusing that
answer costs nothing. Adding a stage parameter would split one cached listing into two
that differ only by a predicate the client can apply itself.

### The read-only view renders through the same editor, made non-editable

Rather than a second renderer walking the ProseMirror JSON. A separate renderer would
have to re-implement the image node, and the two would drift the first time either
changed — with the failure showing up as a description that renders differently
depending on which dialog opened it.

So the description component takes an `editable` flag; when false TipTap renders the
document and accepts no input, and the paste and drop handlers are not installed.

### The list is a component of its own, given its rows

`TaskList` takes tasks and an `onOpen`, and knows nothing about where they came from.
The project screen hands it the in-flight ones; the campaign screen hands it the
campaign's. Neither screen learns how the other filters.

## Risks / Trade-offs

- [The project screen fetches every task of the project to show four stages] → Accepted:
  it is the listing the board already fetches, so the cost is a cache hit in the common
  case. If a project's history ever makes this heavy, the fix is a stage parameter, and
  the client filter is where it would be replaced.
- [Two dialogs can now render a description] → Mitigated by one component with a flag
  rather than two renderers; the read-only path is the same code with input disabled.
- [A read-only dialog invites "can I just edit here"] → The board is one click away and
  the task's own row on it is where editing belongs. Adding an edit control here would
  duplicate the form dialog and its permissions.

## Migration Plan

No schema change and no data migration. The campaign filter is additive and optional;
the board's listing is unaffected.
