## Decisions

- **Redirect on the web, not an API alias.** Invitations already sent carry the misspelt page
  address, so the web keeps a route for it that replaces the address with the new one, code and
  query kept. Only the web calls the lookup, and it ships together with the API, so the misspelt API
  route is dropped.
