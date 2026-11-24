## Context

`CompanyTeam` shows every person of the client in one list and opens `InvitationDialog` with `registrationType="CLIENT_STAFF"`. That dialog holds its own `Tabs` with «Сотрудник» and «Партнёр» when the reader may invite partners, and the partner branch asks for a project and a campaign. The members endpoint returns staff and partners together, and a partner carries a `campaign`.

## Goals / Non-Goals

**Goals:**
- Show the two audiences as two tabs of the contact book, each with its list and its add button.
- Keep the partner form (project, then campaign) and the staff invitation as they are.

**Non-Goals:**
- Any change to the API, the access matrix or the agency's contact book.

## Decisions

**Split the list on the client.** `CompanyTeam` splits the people into partners (`role === "PARTNER"`) and the rest. No new request is needed, so both tabs update together after a removal or an invitation.

**The tab bar shows when it is useful.** It shows when the reader may create partners (`useCan("create", "partner")`) or when at least one partner is listed. Otherwise the staff list shows alone, without a tab bar, as before. The active tab resets to «Сотрудники» when a partner tab would no longer be offered.

**The dialog takes its audience as a prop.** `InvitationDialog` gets an optional `audience: "STAFF" | "PARTNER"` for `CLIENT_STAFF` invitations. With it the dialog starts in that mode and hides its own tab bar; without it the dialog behaves as before, which keeps every other caller unchanged. The title follows the mode, «Пригласить партнёра» or the existing staff title. Alternative: keep the choice in the dialog and only add the tabs to the list. Rejected because the same choice would then appear twice.

**Buttons stay inside `CompanyTeam`.** Each tab renders its own `Button` in its header, guarded by `Can action="create" resource="invite"`. The partner button also needs `useCan("create", "partner")`. No button is passed as a prop.

**Copy.** New keys: «Партнёры» for the tab, «Партнёры компании» for the heading, an empty state «Партнёров пока нет», and «Добавить партнёра» for the button. «Сотрудники компании» and «Добавить» stay for staff.

## Risks / Trade-offs

- A reader who may not invite partners but whose company has partners sees the partner tab without an add button → intended: they see who the partners are and cannot invite more.
- The removal confirmation and its failure message are shared by both tabs → both come from the same component state, so one confirmation is open at a time.

## Migration Plan

Web change only. Deploy with the next web release; rollback is the previous release.
