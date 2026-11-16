## Why

General profile settings use boxed cards, while the requested reference uses plain rows with a label on the left and a switch on the right.

## What Changes

- Use the existing Switch and normal-weight labels for both settings rows.
- Present the language choice as an English switch: off selects Russian, on selects English.
- Remove the card borders and move explanations below the rows.
- Retain Save, persistence, page reload and dialog closing behavior.
- No breaking changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. Existing profile preference requirements remain intact; this change replaces their controls and layout.

## Impact

The profile settings dialog, its language label translations and existing behavior tests change. No API, storage or dependency changes are needed.
