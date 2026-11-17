## Context

Organizations are created only by the platform administrator through `platform` use cases, which pair a new organization with an `ADMIN` invitation. Accounts are created by `identity` (password hashing, sessions, cookies) and by invitation redemption. Password recovery already holds the pattern this change needs: an unguessable token, a stored hash of it, a replace-on-new-request rule, a mailer over SMTP, and a 503 in production without mail. See proposal.md for the motivation.

## Goals / Non-Goals

**Goals:**
- A visitor ends up as the sole `ADMIN` of a new `TRIAL` organization after proving they hold the mailbox.
- No organization or account exists before the email is confirmed, so an unconfirmed request costs a row and a mail, nothing more.
- The confirmation reuses the mail transport, the token adapter and the rate limiter, and creates the organization through the platform's own rules (slug, tariff, trial end).

**Non-Goals:**
- Captcha or bot scoring. The rate limit and the email gate are the whole defence for now.
- Choosing a tariff on the page. Every signup starts on `TRIAL`.
- Letting an existing account start a second organization. Memberships stay one per account.
- Purging old pending signups on a schedule. Replacing and redeeming keep the table small.

## Decisions

**A new `trial-signups` module owns the flow.** It depends on `identity` (password hashing, session issue) and `platform` (organization creation) through their public `index.ts`, not on their internals. Alternative: add the flow to `identity`. Rejected because it would make identity create organizations, which it knows nothing about.

**Pending requests live in a `TrialSignup` table.** Columns: id, email (unique, lowercased), organization name, display name, password hash, token hash (unique), expires at, created at. A new request for the same email replaces the row, which invalidates the older link, as password recovery does. Redeeming deletes the row inside the creating transaction, so a second concurrent redemption finds nothing to delete and fails. Alternative: store the request in the signed token. Rejected because a link could then not be revoked or limited to one use, and the password hash would travel in a URL.

**The password is hashed when the request arrives.** The row holds a hash, never the password, so a leaked table gives nothing to replay and confirmation needs no second prompt.

**Redemption is one unit of work.** It deletes the pending row, creates the organization with the platform's slug and `trialEndsAtFrom` rules, creates the user and the `ADMIN` membership. The platform's organization creation is split so the organization insert can run in a caller's transaction without issuing a first-admin invitation. Alternative: create the organization, then an invitation, then redeem it. Rejected as three writes to express one.

**The same answer for new and registered emails.** The request answers 202 either way and mails only when the email is free, matching password recovery. The cost is that a visitor who already has an account gets no hint in the page; the page text says "if the address is free" for that reason. The email is re-checked at redemption, where a taken address makes the link fail like any other dead link.

**Links last 24 hours.** Longer than a reset link because a visitor may open the mail the next morning. Token generation and hashing reuse the identity token adapter, with the expiry set per use.

**Mail reuses the transport and the production rule.** A `TrialLinkMailer` sits beside `ResetLinkMailer`, builds the link on the configured app address, and reports whether it is available. Without mail in production the request answers 503.

**The web page lives in FSD `pages/trial` and `pages/trial-confirm`**, with the form in `features/auth` next to the sign-in and reset forms. The confirmation page redeems on mount, then stores the session as the reset page does and navigates into the app. A double mount in development must not redeem twice; the page guards with a ref, and a second call fails harmlessly anyway.

**The landing links to the app.** `TrialButton` points at `{appUrl}/trial`. The footer keeps «Пробный период» as a contact topic for people who prefer to write.

## Risks / Trade-offs

- A bot fills the table with pending rows → the rate limit bounds it, and replacing by email caps rows per address. A purge job can follow if it grows.
- A mail scanner that opens links redeems the signup before the visitor does → the visitor then lands signed in on their own organization only if the scanner shares their cookie jar, which it does not; they would see a dead link. Redemption is therefore a `POST` sent by the page, not a `GET`, so a scanner that only fetches the URL redeems nothing.
- Someone signs up with another person's email → they cannot confirm it, and the owner gets one unsolicited mail that says it can be ignored.
- Trial farming with throwaway addresses → accepted; an expired trial turns read-only, and the platform administrator can delete organizations.

## Migration Plan

Add the `TrialSignup` table with a Prisma migration. Deploy the API, then the web app, then the landing change, so the button never points at a missing page. Rollback is the reverse; the table can stay.
