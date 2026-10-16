## Context

Every table that belongs to an organization references it with `ON DELETE CASCADE`, and
every reference to a membership either cascades or is set to null, so one delete of the
organization row removes its data. Accounts (`app_user`) are not owned by an organization;
a person belongs to one organization through one membership in practice.

## Goals / Non-Goals

**Goals:** remove an organization and its people completely, guarded against a slip.

**Non-Goals:** removing the files the organization stored in S3 (avatars, pictures,
attachments, covers); a soft delete or a recycle bin; deleting from the organization side.

## Decisions

- **Accounts go with the organization** when they hold no membership elsewhere. Left
  behind they could still sign in to nothing, and their addresses would stay taken, so the
  same people could never be invited again. The platform administrator's own account has
  no membership and is never touched.
- **One transaction**: collect the people whose every membership is in this organization,
  delete the organization (the database cascades its data and memberships), then delete
  those accounts. Refresh tokens and password resets cascade from the account.
- **Typed confirmation in the UI.** The delete button stays disabled until the exact name
  is typed; the API itself needs no such argument.
- **Icons with names.** Each icon button keeps an `aria-label` naming the action and the
  organization, and a tooltip shows the action on hover; the power button's label and
  tooltip say whether it suspends or reactivates.

## Risks / Trade-offs

- Stored files become orphans in the bucket → acceptable until a storage sweep exists.
- Deletion is irreversible → typed name, and suspension remains the reversible option.
