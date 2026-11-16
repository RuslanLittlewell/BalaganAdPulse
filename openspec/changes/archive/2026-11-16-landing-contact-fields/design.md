## Decisions

- Email uses the browser's own required and format check, so an invalid or empty address stops the submission before the script or the mail draft runs.
- The script finds the form through its email input and reads the other fields by label, so no landing-specific code is added.
- The key in the script tag is public by design; the landing's host is on the key's list of allowed sites.
