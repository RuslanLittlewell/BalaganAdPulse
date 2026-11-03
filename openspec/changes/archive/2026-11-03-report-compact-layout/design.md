## Context

The report view in `ReportsPage` is a full-width column. The leads card (`EditableFigure` in
`MonthlyReport.tsx`), the contacts card (`ContactsFigure.tsx`) and the conclusions and plan
blocks (`ReportText.tsx`) each render their edit control as a text button in the flow.

## Goals / Non-Goals

**Goals:**
- A narrower report column on large screens.
- One edit control look across the report's blocks.

**Non-Goals:**
- Changing other controls on the page: "Вернуть данные Meta", the fourth-figure select, "Заполнить
  прошлые месяцы", "Выбрать креативы" and the staff bar stay as they are.

## Decisions

### The width applies to the whole report view, for every role

`ReportView` gets `w-full` and, from the `lg` breakpoint, `w-[70%]` centred with `mx-auto`. Staff
create and edit reports on this page, and customers read the same page, so one width keeps the
two views alike. Phones and tablets keep the full width, which the mobile layout relies on.

### The pencil is an absolutely positioned icon button inside the block

Each block becomes `relative`; the edit control is a `Button` with `size="icon-sm"`,
`variant="ghost"`, a `PencilIcon`, `absolute top-2 right-2`, and the same `aria-label` the text
button had. The block's label or title gets right padding so it never runs under the icon. The
icon is hidden while the block is being edited, as the text button was.
