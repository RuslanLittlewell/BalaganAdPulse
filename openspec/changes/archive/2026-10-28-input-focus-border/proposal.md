## Why

A focused field draws a three-pixel ring around itself on top of recolouring its border. The
agency wants a field to show focus by its border colour alone.

## What Changes

- Text inputs, textareas, select triggers, the comment box and the calendar's month and year
  dropdowns lose the focus ring and keep the border turning the accent colour on focus.
- An invalid field keeps its red border; the red ring that came with focus goes too.
- Buttons, cards, tabs, switches and links keep their focus rings, which are how keyboard
  focus shows on them.

## Capabilities

### New Capabilities

### Modified Capabilities

No spec describes focus styling, so no requirement changes; the change sets `skip_specs`.

## Impact

- Web: `shared/ui/ui/input.tsx`, `shared/ui/ui/select.tsx` (also used by `MultiSelect`),
  `shared/ui/ui/calendar.tsx`, the task comment box and the lead note textarea.
