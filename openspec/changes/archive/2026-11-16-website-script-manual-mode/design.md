## Decisions

- Manual mode is an attribute on the script tag, not a second script, so switching modes means editing one tag.
- `balagan.lead` resolves to true once the request is accepted by the network layer and to false on a network failure. The server answer is not read: the endpoint is called without a readable response for sites that are not on the list, and a lead the server refuses must not block the visitor.
- An object of fields becomes question and value pairs in its key order. Empty values are dropped.
- The honeypot field is not added in manual mode, since the site's code decides what to send.
