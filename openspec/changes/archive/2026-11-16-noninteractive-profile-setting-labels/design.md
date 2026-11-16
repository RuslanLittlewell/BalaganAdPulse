## Context

HTML labels on General use htmlFor, which forwards clicks to selects and switches. Telegram uses the shared Label rendered as a span.

## Goals / Non-Goals

Remove caption interaction in General while preserving visual styling and accessible control names.

## Decisions

Replace the four captions with plain spans. Give the language, theme and campaign CRM spans IDs and reference them from the controls through aria-labelledby. Preserve Telegram's existing section naming relationship.

## Risks / Trade-offs

Removing native label associations would remove accessible names unless replaced by explicit aria-labelledby references.
