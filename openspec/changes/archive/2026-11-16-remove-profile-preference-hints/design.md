## Context

Two paragraphs below the General controls are referenced by their switches through aria-describedby.

## Goals / Non-Goals

Remove the entire explanation block while preserving controls and saving behavior.

## Decisions

Delete the block, both accessibility references and the unused Russian and English dictionary entries.

## Risks / Trade-offs

Accessibility references must be removed together with their target elements.
