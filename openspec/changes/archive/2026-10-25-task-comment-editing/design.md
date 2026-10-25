## Decisions

- **Only the author edits.** An admin may delete someone else's comment but not put words in their
  mouth, as in Telegram.
- **Tags on edit.** The edit carries the full list of tags, validated as when adding. Notices go only
  to members in the new list who were not tagged before, so fixing a typo never pings anyone twice.
- **`edited_at`.** A nullable timestamp set on every edit; the interface shows «изменено» when it is
  set. Comments stay ordered by when they were written.
- **One field for writing and editing.** Editing loads the comment into the composer under a bar
  naming it; saving or Escape returns the composer to writing. Enter inside the mention offer still
  chooses a person.
- **Growth.** The field starts at one line and grows with its content up to a cap, then scrolls.
