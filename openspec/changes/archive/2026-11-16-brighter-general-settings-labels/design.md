## Context

General uses small, muted labels for language, campaign CRM and Telegram.

## Goals / Non-Goals

Make these labels larger and brighter without changing preference behavior.

## Decisions

Apply text-sm and text-foreground consistently to the three labels through Tailwind. Retain normal font weight and theme-aware foreground colors.

## Risks / Trade-offs

The slightly wider labels share their row with controls; existing flexible row sizing remains in place.
