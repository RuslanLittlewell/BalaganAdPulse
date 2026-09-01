## Why

The board is shared work: several media buyers move cards on it at the same time.
Today a member only ever sees their own changes. A card someone else moved stays
where it was until the page is reloaded, so two people routinely drag the same
card from what each believes is its current column, and the last write silently
wins.

The board also refetches the whole task list after every move. That request tells
the mover nothing they do not already know — the optimistic update has already
drawn the result — and it grows with the number of people dragging, precisely
when the board is busiest.

## What Changes

- Add a WebSocket endpoint that authenticates with the same bearer token as the
  REST API and streams task changes to members while they have the board open.
- Publish a task event on every create, update, delete and move, after the
  transaction commits, so no member is ever told about a change that was rolled
  back.
- Deliver each event only to connections entitled to see that task, evaluated
  per delivery against the actor's current role and grants — not against what
  they held when the socket opened.
- Apply incoming events straight into the client's task cache, so another
  member's move appears without a request.
- **BREAKING** (internal): the board no longer refetches the task list after a
  move. The mutation's own response is the authoritative row.
- Refetch once on reconnect, to close the gap where events were missed while the
  socket was down.

## Capabilities

### New Capabilities
- `realtime-board-sync`: authenticated, reach-filtered live delivery of task
  changes to connected members, and the board's use of those events in place of
  polling or refetching.

### Modified Capabilities

## Impact

- **API**: new `realtime` module (connection registry, delivery authorization,
  `ws` transport adapter); `TaskEventPublisher` port called by the task use
  cases; WebSocket upgrade wired in the composition root and drained on shutdown.
- **Web**: new task-event subscription in the task entity; `useMoveTask` stops
  invalidating the task list.
- **Dependencies**: adds `ws` to `apps/api`.
- **Deployment**: the platform must route WebSocket upgrades to the API service.
