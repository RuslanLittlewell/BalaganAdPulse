## Context

The picker holds the ids sent as `memberIds`. Until now it started empty and the API refused
admins.

## Decisions

- The default is derived, not stored: while the creator has not touched the picker it stands for
  "every active admin", so admins loaded after the form opens are still chosen. The first change
  the creator makes turns it into their own explicit list.
- The API accepts admins as it accepts managers and guests; nothing else about naming
  participants changes.
