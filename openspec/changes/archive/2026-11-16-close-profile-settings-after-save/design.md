## Context

General saves browser preferences synchronously; Account waits for the profile API. Both already report their result through the global alert system.

## Goals / Non-Goals

Complete both Save interactions by closing the dialog after success. Existing persistence, validation and notification behavior remains in place.

## Decisions

Call the existing close handler only on each successful path. For a changed language, close before calling the existing reload helper. Keep failures and pending requests inside the dialog.

## Risks / Trade-offs

Closing removes form elements from the document. Tests must check the global notification after closing and exercise the dialog through a controlled parent.
