## Context

Telegram uses a heading while other General settings use Label. It currently follows campaign CRM.

## Goals / Non-Goals

Use consistent label rendering and reverse these two rows without changing their controls.

## Decisions

Render the shared Label as a span and preserve the ID used by the section's accessible name. Move the existing Telegram component before campaign CRM.

## Risks / Trade-offs

The Telegram text describes a group of controls, so it must not become an input label for an unrelated action.
