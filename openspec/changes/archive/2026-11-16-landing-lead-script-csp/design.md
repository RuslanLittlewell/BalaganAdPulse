## Decisions

- The allowed origin comes from the configured application URL, so development and production each allow their own host.
- Only `connect-src` changes. Scripts, styles, images and forms keep their current rules.
