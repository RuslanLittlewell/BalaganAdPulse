## Context

The calendar draws every task it is given on its due date, whatever its stage; the board keeps
finished tasks in its own columns.

## Decisions

- The calendar drops tasks in a terminal stage (done, archived) itself, so every view built on
  it behaves the same and an optimistic close removes the card at once.
- A finished task is reopened from the board, where its column remains.
