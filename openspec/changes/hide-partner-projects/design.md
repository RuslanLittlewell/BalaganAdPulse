## Context

A partner's session lists the modules `PROJECTS` and `CRM` when the organization has the CRM
module. The web app sends a partner home to their project page, keeps the partner's menu to the
project and the CRM, and serves the project and campaign pages under `/projects`. The partner's
CRM reads the names of their campaigns from `/api/projects/:id/campaigns/names`.

## Goals / Non-Goals

**Goals:**

- Hide the projects module from partners in the web app while the CRM is available to them.
- Keep the change small enough to revert in one step.

**Non-Goals:**

- Refusing project figures to partners in the API. The CRM depends on the project's campaign
  names, and the request is about what partners see.
- Changing what agency or client members see.

## Decisions

- One function in the auth feature decides, from the session's modules and partner binding,
  whether a partner sees the projects module and where their home is. The routes and the menu
  read it, so reverting the change means changing that function and its callers back.
- A partner sees the projects module only when the organization has no CRM module. Hiding it
  then too would leave the partner with an empty menu and nowhere to land.
- The `/projects` routes send such a partner to the CRM with a redirect instead of a not-found
  page, so old bookmarks and notification links still lead somewhere useful.

## Risks / Trade-offs

- Partners can still read their project figures through the API. This is accepted while the
  hiding is temporary.
- This change and `partner-campaigns` modify the same requirement. This change must be archived
  after `partner-campaigns`.
