## Context

The organization's left menu is `widgets/main-nav/MainNav`, built on the shared `Sidebar`.
`Sidebar` has unused `action` and `footer` slots that take a `ReactNode`, which the
project's button rule forbids for buttons. The API already sends mail through
`MailTransport` (`SmtpMailTransport`, or `LogMailTransport` when SMTP is unset), used by
password recovery. There is a shared `createRateLimit` middleware, multer for uploads, and
a trial guard mounted after actor resolution that refuses writes on an expired trial.

## Goals / Non-Goals

**Goals**
- One dialog reachable from every organization screen, for every role.
- Feedback that reaches support with enough context to act on, without a new table.

**Non-Goals**
- A ticket list, statuses or replies inside the app.
- Help articles or a FAQ.
- Feedback from the platform administrator or from signed-out visitors.

## Decisions

- **New `support` module in the API.** `application` holds `sendFeedback` and `contacts`. Ports: `SupportMailbox` (sends one message with attachments) and `SupportSettings` (the support email). The session data (organization, name, email or login, role, tariff) comes from the actor and the tariff summary the kernel already has, never from the body.
- **Mounted before the trial guard.** `ROUTE_MOUNTS` gets `support` at `/api/support` right after `request-context` and before `trial-guard`, so an expired trial can still write to support. Actor resolution stays in front, so suspended organizations and the platform administrator are refused as everywhere else.
- **Multipart with multer in memory.** Fields `topic`, `message`, `page`, `userAgent`, `screen`, files under `screenshots`, limits of 3 files and 5 MB each. The type is checked on the file signature, not on the declared MIME type, the same way task images are. Zod validates the fields and drops unknown ones, so a forged `organization` field is ignored rather than refused.
- **Mail transport grows two optional fields.** `MailMessage` gains `replyTo?` and `attachments?: { filename, content: Buffer, contentType }[]`. `SmtpMailTransport` passes them to nodemailer. `LogMailTransport` logs the attachment names and sizes. Password recovery is unaffected.
- **Synchronous send.** Unlike the reset link, feedback awaits the transport and answers 503 on failure, so the person knows their message did not leave and keeps it in the form.
- **Availability.** Feedback is available when `SUPPORT_EMAIL` is set and SMTP is configured. With SMTP unset in development, the `LogMailTransport` counts as configured, so the form works locally and prints the email.
- **Rate limit.** `createRateLimit({ windowMs: 10 min, limit: 5 })` keyed by user id on the POST route only.
- **Email body.** Plain text and escaped HTML in Russian, like the reset link: topic, message, then a context table. Subject: `[Balagan BI] <topic> · <organization>`, the brand the users see and the password email uses.
- **Sidebar help button from props.** `Sidebar` gets `help?: { label: string; collapsed: boolean; onOpen: () => void }` and renders the button itself in a bottom region, styled as a nav item, with a tooltip when collapsed. `MainNav` owns the open state and renders the dialog. `PlatformNav` passes no `help`. The unused `footer` slot is removed, since its only purpose would now break the button rule.
- **Mobile.** On narrow screens the sidebar is a bottom bar; the help item becomes its last item, after the sections.
- **Dialog layout.** `features/help-feedback` holds `HelpFeedbackDialog`, which holds the form alone: topic as a select, message, screenshots, send. The technical context goes along without a notice. The email and the availability come from `GET /api/support/contacts` through React Query and appear only in the unavailable notice and in the error after a failed send.
- **Screenshots in the web app.** The shared `Dropzone` takes one file at a time, picked or dropped; a paste handler on the dialog takes every image in `clipboardData.files`. Thumbnails use object URLs, revoked on removal and when the dialog closes. The form checks type and size before attaching, and the API checks them again.

## Risks / Trade-offs

- Email only means no history in the app. If mail delivery fails silently after SMTP accepted the message, the feedback is lost. Accepted by the user's choice; a stored copy can come later.
- Attachments of up to 15 MB pass through SMTP. Gmail accepts 25 MB, so this fits.
- The rate limit is in memory and per process. With one app process in production that is enough.

## Migration Plan

1. Set `SUPPORT_EMAIL=balagan.ads@gmail.com` in the production `.env` before the release.
2. Deploy. Without `SUPPORT_EMAIL` the form shows a notice instead of failing.

## Open Questions

None.
