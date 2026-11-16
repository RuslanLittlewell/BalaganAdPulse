## Context

TelegramBotSection currently uses a bordered card with a stacked heading, connected status and notification label.

## Goals / Non-Goals

Match the plain General settings rows while preserving all Telegram actions.

## Decisions

Use Tailwind for a heading on the left and a compact action group on the right. Render the status, username, notification switch and disconnect action in that order. Give the switch its existing localized accessible name without a visible label. Allow the username to truncate on narrow screens. Keep unlinked and pending instructions below the row.

## Risks / Trade-offs

Long usernames must not displace the switch or disconnect action. The shared component also appears in the task-page popover, so its children must be able to shrink.
