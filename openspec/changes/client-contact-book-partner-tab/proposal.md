## Why

A client's principal who may invite partners sees one list called «Сотрудники» that holds staff and partners together, and one «Добавить» button. The split into «Сотрудник» and «Партнёр» appears only after the button is pressed. The principal has to open a dialog to learn that partners exist, and cannot see who the partners are apart from the staff.

## What Changes

- The contact book of a client's cabinet opens with two tabs, «Сотрудники» and «Партнёры», whenever the reader may invite partners or the company already has a partner.
- «Сотрудники» lists the company's people who are not partners and has its own add button. «Партнёры» lists only partners, with their campaigns, and has its own add button.
- The invitation dialog no longer offers the choice between «Сотрудник» and «Партнёр». The button the reader pressed decides which invitation the dialog creates.
- A reader who may not invite partners and sees no partners keeps the single list without a tab bar.
- This reverses the sentence «there SHALL be no Partners tab» in `project-partners`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `project-partners`: the contact book of a client's cabinet gets the two tabs with their own lists and add buttons, and the invitation dialog loses its choice of who to add.

## Impact

- Web only: `widgets/contact-book/CompanyTeam.tsx` gets the tabs and the two lists, `features/invitations/ui/InvitationDialog.tsx` takes the audience from its caller, dictionary keys in `ru.ts` and `en.ts`, and the tests of both.
- No API, database or access-policy change: the members endpoint already returns staff and partners together.
