## Why

There are two ways into the application and only one of them is right.

`/regustration/:code` reads the invitation, decides which of the three forms it calls
for, and asks for exactly what that kind needs. `/signup` asks the visitor to type an
invitation code by hand into a form that only ever knew one shape — a name, an email and
a password. That was the whole story when every invitation was an employee's. It is not
any more: a client's code needs a company and a first project, and neither can be given
there.

So the older screen is not merely a second door. For two of the three kinds of invitation
it is a door that leads into a wall.

## What Changes

- The `/signup` screen leaves the interface, along with the "no account yet" link that
  led to it.
- `/signup` redirects to the sign-in form, so a bookmark does not land on nothing.
- Getting in is by invitation link alone.

## Capabilities

### Modified Capabilities

- `registration-invitations`: the invitation link is the only way to register.

## Impact

- `apps/web`: the signup page, its route, its tests, the link on the sign-in screen, and
  the strings only it used.
- `apps/api`: untouched. It already requires an invitation code on registration and
  refuses one that cannot be redeemed — that enforcement is what makes this safe to
  remove rather than a hole to open.
