## Decisions

- Code 100 is a general invalid parameter code, so the classifier also requires the message to contain "permission". Other code 100 refusals stay invalid data.
- The Graph error body already carries the message; the classifier receives it next to the code.
- Skipping individual ads is not added. In both projects every ad is refused for the same reason, so the cause is the token, not one ad.
