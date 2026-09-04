## Why

Two things about the employee directory read wrongly once it is used.

The person reading it is in it. Nobody opens a directory to find themselves, and the row
is worse than useless: it is the one entry whose access an admin must not casually change
while looking at everybody else's.

And a project is shown to them as a line of text — in the list of what somebody reaches,
and in the control that grants another. Everywhere else in this application a project is
its picture and its name, which is how anybody recognises one at a glance. Removing one is
also a single unconfirmed click on a row of otherwise identical rows.

## What Changes

- The reader does not appear in the employee directory. They still appear everywhere a
  person is *chosen* — being made responsible for a task, above all.
- A project is shown with its picture and its name, in the granted list and in the control
  that adds one.
- Removing a granted project is a cross on its picture, and asks before it acts.

## Capabilities

### Modified Capabilities

- `contact-directory`: who the employee directory lists, and how a project appears in it.

## Impact

- `apps/web`: the employee directory and its access block. No API change: the listing
  still answers with everybody, because the screens that *pick* a person need the reader
  in it.
