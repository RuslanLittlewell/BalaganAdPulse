## ADDED Requirements

### Requirement: Sites with their own forms can send leads from code

The script tag SHALL accept `data-mode="manual"`. In that mode the script SHALL NOT watch form submissions and SHALL NOT add the honeypot field, and SHALL still store UTM tags and offer `balagan.lead`. The function SHALL accept the other form fields as a list of question and value pairs or as an object of questions to values, drop empty values, send the stored UTM tags and the page, and return a promise that resolves to true when the request was sent and to false when it could not be sent. The website leads dialog SHALL explain manual mode and show an example call.

#### Scenario: A custom form reports success
- **WHEN** a site in manual mode calls `balagan.lead` with a name, a phone and a fields object after its own request succeeded
- **THEN** one lead is sent with the stored UTM tags and the fields as question and answer pairs

#### Scenario: Manual mode ignores form submissions
- **WHEN** a visitor submits a form with a phone input on a site in manual mode
- **THEN** the script sends nothing

#### Scenario: The request cannot be sent
- **WHEN** the network request fails
- **THEN** the promise resolves to false and the page is not interrupted
