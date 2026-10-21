## ADDED Requirements

### Requirement: BalaganBI has a public home page that explains it

The landing host SHALL answer its root with a page that anyone can read without signing in. The
page SHALL name the app BalaganBI, as on the Google consent screen, and SHALL state in its served
HTML, without depending on scripts: what BalaganBI does; that a Google Ads account is connected by
its user signing in with Google; which Google Ads data is read, that it is only read and never
changed, and what it is used for; that it is not sold, shared or used for advertising or to train
AI models; and how access is revoked. It SHALL link to the privacy policy and to the app's sign-in.
It SHALL be in Russian with an English section.

#### Scenario: A visitor who is not signed in
- **WHEN** anyone opens `https://bi.balagan.pro/`
- **THEN** the page explains BalaganBI and its use of Google Ads data, with no sign-in asked

#### Scenario: A reader without scripts
- **WHEN** the home page is fetched as plain HTML
- **THEN** the explanation and the link to the privacy policy are in the document

### Requirement: BalaganBI publishes a privacy policy covering Google user data

The landing host SHALL serve a privacy policy at `/privacy`, readable without signing in, stating
who provides the service and how to reach them, which data is processed, which Google Ads data is
obtained through which permission and why, how it is stored and protected, that it is not sold,
shared, used for advertising or to train AI models, how access is revoked and data deleted, and
that the use of information received from Google APIs adheres to the Google API Services User Data
Policy, including the Limited Use requirements.

#### Scenario: Reading the policy
- **WHEN** anyone opens `https://bi.balagan.pro/privacy`
- **THEN** the policy is shown, including the Limited Use statement and a contact address

### Requirement: The landing wears the app's look

The landing SHALL use the web app's colours, light or dark after the visitor's system preference.
Its opening SHALL greet the visitor as the app's sign-in page does: the light rays behind, and the
handwritten Balagan signature centred above the heading and its lead text. The rest of the page
SHALL have the app's animated waves behind it, and its sections and cards SHALL appear as they are
scrolled into view. Every animation SHALL stand still for a visitor who prefers reduced motion,
and the pages SHALL read the same where WebGL or scripts are unavailable.

#### Scenario: Reduced motion
- **WHEN** a visitor who prefers reduced motion opens the home page
- **THEN** the rays, the waves and the signature stand still, and every section is shown at once

#### Scenario: Without scripts
- **WHEN** the home page is read without running scripts
- **THEN** every section and card is in place, none of them waiting to appear

### Requirement: The landing is served by the app on its own host

The application SHALL serve the built landing to requests for the landing host, configured by
`LANDING_HOST` and `bi.balagan.pro` by default, and SHALL answer a path the landing does not have
with the landing's not-found page and status 404. Requests for any other host SHALL reach the API
and the web app exactly as before. The landing SHALL be built and shipped in the same image and
deployment as the API and the web app.

#### Scenario: The landing host
- **WHEN** a request for `bi.balagan.pro` asks for `/`
- **THEN** the landing's home page is served, not the web app

#### Scenario: The app host
- **WHEN** a request for `app.balagan.pro` asks for `/`
- **THEN** the web app is served as before

#### Scenario: No API on the landing host
- **WHEN** a request for `bi.balagan.pro` asks for `/api/projects`
- **THEN** the landing's not-found page answers with 404
