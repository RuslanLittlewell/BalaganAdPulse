## MODIFIED Requirements

### Requirement: Responses carry protective headers

Every response SHALL tell the browser not to guess content types (`X-Content-Type-Options:
nosniff`), not to show the app inside another site's frame (`X-Frame-Options: DENY` and a
`frame-ancestors 'none'` policy), to send only the origin as the referrer to other sites
(`Referrer-Policy: strict-origin-when-cross-origin`), and to load no plugins and keep the
document's base (`object-src 'none'; base-uri 'self'`). The content security policy SHALL also
allow scripts only from the app's own origin with no inline scripts and no `eval`, connections
only to the app's own origin and its WebSocket, frames only from Facebook's ad preview hosts,
images and media only from the app, `data:` and `blob:`, and form submissions only to the app.
Responses SHALL NOT carry `X-Powered-By`. The documentation page, when served, MAY allow the
inline script it needs. The landing keeps its own stricter policy.

#### Scenario: The app's page
- **WHEN** the browser loads the app or any API endpoint
- **THEN** the response carries those headers and no `X-Powered-By`

#### Scenario: An injected script
- **WHEN** a page of the app contains an inline `<script>` that did not come from the app's files
- **THEN** the browser does not run it
