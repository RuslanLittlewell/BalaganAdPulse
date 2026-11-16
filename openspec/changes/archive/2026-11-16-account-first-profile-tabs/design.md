## Context

The dialog currently lists and initially selects General before Account.

## Goals / Non-Goals

Put Account first without moving settings between tabs or changing save behavior.

## Decisions

Reverse the existing tab items and set Account as the initial selection and the selection restored whenever the dialog opens.

## Risks / Trade-offs

Tests that enter General must select it explicitly. Keyboard navigation follows the displayed order.
