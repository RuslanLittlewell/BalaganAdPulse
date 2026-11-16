## Why

The site script finds forms by their submit event. A form that sends its data from its own code, or that the site rejects after the event, either goes unseen or produces a lead the site never accepted. The site's own code knows when a submission succeeded, so it needs a way to report that and to switch automatic detection off.

## What Changes

- A script tag attribute `data-mode="manual"` turns off automatic form detection. The script still stores UTM tags and still offers `balagan.lead`.
- `balagan.lead` takes the other form fields either as a list of question and value pairs or as an object, and returns a promise that says whether the lead was sent.
- The website leads dialog explains the mode and shows an example for custom forms.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `website-lead-intake`: manual mode and the shape of `balagan.lead`.

## Impact

The script text, the website leads dialog and its copy.
