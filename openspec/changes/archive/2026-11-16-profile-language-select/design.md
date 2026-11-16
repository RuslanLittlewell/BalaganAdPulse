## Context

General stores the selected locale as ru or en and currently presents it as an English switch.

## Goals / Non-Goals

Replace only the language control while retaining the current settings layout and save behavior.

## Decisions

Reuse the shared Select with the existing language label and autonym translations. Keep it on the right of the row and bind it to the existing locale state. Remove the unused English-switch label.

## Risks / Trade-offs

The label must target the select trigger so keyboard and screen-reader users can identify the control.
