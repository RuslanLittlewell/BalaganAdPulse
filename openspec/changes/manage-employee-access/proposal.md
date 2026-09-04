## Why

The employee directory shows who somebody is and stops there. What they can actually
reach — the projects their grants cover — is the thing an admin needs when a colleague
says they cannot see a client, and it is the one thing the screen does not say. Changing
it has an endpoint and no interface at all.

Two smaller things sit in the way of using that screen. The list of outstanding
invitations is pinned under the directory, where it competes with the person being read;
it belongs with the control that makes one. And the person's own fields are laid out
differently from the client's, for no reason other than that they were written on
different days.

## What Changes

- An employee's details show the projects they reach, and an admin adds and removes them
  there.
- The list of outstanding invitations moves out of the contact book into the invitation
  dialog, beside the control that creates one.
- The contact book gets a minimum height, so its panes stop resizing as one selects.
- An employee's fields are laid out the way a client's are.

## Capabilities

### Modified Capabilities

- `organization-membership`: a member's grants can be read, not only replaced.
- `contact-directory`: where invitations are listed, and how a person is laid out.

## Impact

- `apps/api`: reading a member's grants.
- `apps/web`: the employee directory, the invitation dialog and the contact book's shell.
