## 1. Extract `ClientDirectory`

- [x] 1.1 Create `apps/web/src/widgets/contact-book/ClientDirectory.tsx`,
  mirroring `EmployeeDirectory.tsx`'s shape (self-contained, no props): move
  in the `useClients` query, the `selectedId`/`mode` state, `select`/`close`
  handling, and the `contact-book-columns`/`contact-book-list`/
  `contact-book-details` markup (list with the create button, details pane
  with the edit button, `ContactDetails`/`EmptyState`/`ContactForm`) exactly
  as `ContactBook.tsx` renders it today — same `data-testid`s, same
  conditions, same copy.
- [x] 1.2 Update `ContactBook.tsx` to render `<ClientDirectory />` in place
  of the inline `isAgency && directory === "CLIENT"` block, and remove the
  now-unused `selectedId`/`mode`/`select`/`editing` state and the
  `ContactDetails`/`ContactForm`/`ListItem`/`Loader` imports that moved with
  it. Leave the unrelated `!isAgency && ownCompanyId` `CompanyTeam` branch
  exactly as it is — it is a different component for a different (non-agency)
  case, not part of this extraction. `Tabs` and the `Dialog` chrome stay in
  `ContactBook.tsx`. (One deliberate, minor deviation from "zero behavior
  change" — see note below.)
- [x] 1.3 Run `npm run test:web -- ContactBook` and then the full
  `npm run test:web`, unchanged, to confirm the extraction is behavior- and
  markup-preserving (no test edits expected). 133 files / 1101 tests green,
  zero test edits. `npm run build -w @adpulse/web` also clean.

**Note on the one behavior nuance**: the original `ContactBook.close()` reset
`mode` to `{ kind: "view" }` *synchronously*, before the dialog's ~200ms
close animation started, so a client mid-edit would visibly snap back to the
view state during that closing animation. `ClientDirectory` is now
self-contained state (mirroring `EmployeeDirectory`, matching the ask), and
Radix already unmounts `DialogContent`'s children once the close animation
finishes — so reopening the dialog still always shows the view state either
way; the only thing lost is that one component snapping back *during* the
close animation instead of just fading out together with it. Judged not
worth an extra prop + effect to preserve a sub-200ms animation detail nobody
had a test for; flagging it here rather than silently dropping it unnoted.
Separately: the `Tabs`' `onSelect` no longer force-resets mode when switching
directories — it doesn't need to, since switching away from "CLIENT" now
unmounts `ClientDirectory` (discarding its state) and switching back mounts
a fresh instance, which achieves the same reset structurally instead of
imperatively.
