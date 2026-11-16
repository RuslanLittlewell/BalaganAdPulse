## Context

The reference is the existing CRM options row: a normal-weight Label and the shared Switch. General currently uses cards and a language select.

## Goals / Non-Goals

Match the reference using Tailwind and existing shared controls. Preserve preference values and save behavior.

## Decisions

Use two plain horizontal rows. Bind the English switch to the existing locale state and keep explanations below the rows with accessible descriptions. Reuse the shared switch dimensions and theme colors without changing it globally.

## Risks / Trade-offs

A language switch needs an explicit label naming English so its off state means Russian. Existing behavior tests will exercise both directions.
