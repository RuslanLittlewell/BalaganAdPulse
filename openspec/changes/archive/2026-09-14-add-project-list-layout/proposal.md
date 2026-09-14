## Why

The project list is sorted by priority, so a media buyer cannot keep the handful of projects they touch every day within reach, and cannot separate the ones they merely watch from the ones they run. The arrangement is a personal working habit rather than agency-wide data, so each member needs their own order, their own pinned projects and their own groups without changing what anyone else sees.

## What Changes

- Order the project list by dragging its items. The manual order replaces the priority sort; the priority marker and the priority filter stay as they are.
- Pin a project from its context menu. Pinned projects sit above everything else, are separated from the rest by a thick border, and take no part in dragging.
- Create a named group from the context menu of the list area itself, through a dialog asking for the name. An empty group is a card the size of a project with a dashed grey border and a header carrying its name.
- Drag projects into a group and back out of it, and drag a whole group among the top-level items.
- Delete a group only while it is empty; a group holding projects cannot be deleted.
- Store the arrangement per member: a new personal layout resource on the API carries one member's order, pins and groups, and is invisible to other members.
- Show projects that have no place in the stored layout yet — newly created ones — at the end of the list.
- No breaking API changes; the existing project endpoints are untouched.

## Capabilities

### New Capabilities

- `project-list-layout`: each member arranges their own project list — the order of its items, which projects are pinned above it, and the groups projects are collected into.

### Modified Capabilities

None.

## Impact

The project list widget and its drag and drop, a new personal layout module in the API with its own Prisma models and migration, the projects React Query cache, Russian localization, and the OpenAPI document. Project records, their `position` column and every other project endpoint stay as they are.
