## Context

The vendored base input and select trigger recolour the border to `--ring` and add a
`ring-[3px]` in the same colour at half opacity; a few hand-made fields copy that pair.

## Goals / Non-Goals

**Goals:**
- Every typed or chosen field shows focus by its border alone.

**Non-Goals:**
- Focus rings on buttons and other controls, including buttons that open a date picker.

## Decisions

- **Edit the vendored base classes.** The input and select trigger are the source of every
  field's look, and the project already adjusts them; overriding at each call site would miss
  fields.
- **The border transition replaces the shadow one**, since the shadow no longer changes.
- **The ring colour classes for invalid fields go with the ring**: without a ring width they
  do nothing.

## Risks / Trade-offs

- [Focus is less prominent] → the accent border stands clearly apart from the resting input
  border in both themes.
