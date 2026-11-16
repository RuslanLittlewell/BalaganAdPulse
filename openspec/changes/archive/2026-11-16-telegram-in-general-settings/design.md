## Context

The dialog embeds TelegramBotSection inside Account. Both tab panels stay mounted when switching tabs.

## Goals / Non-Goals

Place Telegram integration on General while retaining its connection, polling, disconnection and notification behavior.

## Decisions

Move the existing section before General's footer. Keep a single mounted instance so its pending connection state survives tab changes. The Telegram contact field remains on Account as part of the personal profile.

## Risks / Trade-offs

Telegram controls sit inside the General form. Existing action buttons already use type="button" and must not submit General preferences or close the dialog.
