# Profile Settings Design

The account menu opens a profile settings modal. Users can update their display name,
change their password by confirming the current password, and generate a new avatar.
Profile updates issue a fresh access token so the header updates immediately. The
browser generates the avatar with `avataaars`, converts its SVG to a 256×256 PNG, and
uploads the PNG to the API. The API validates and stores those bytes in S3, then writes
the authenticated avatar URL to the user's `image` field and the complete serialized
selection to `avatarPath`. Opening settings fetches this configuration so the editor
always reproduces the stored PNG. It never generates an avatar.

Dialogs use the shadcn/Radix primitive, including enter/exit transitions, Escape and
outside-click dismissal. Avatar editing opens a second large dialog exposing all 13
option groups supplied by `avataaars`. Every application form uses `react-hook-form`.
