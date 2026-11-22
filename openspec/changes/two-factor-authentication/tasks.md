## 1. Data and primitives

- [x] 1.1 Add the tables, the organization column and the migration
- [x] 1.2 Add the TOTP adapter, backup code generator, QR renderer and sealing, and test them against RFC 6238 vectors

## 2. API

- [x] 2.1 Create the `two-factor` module: status, setup, confirm, disable, backup codes, trusted addresses, challenges, requirement, resets
- [x] 2.2 Return a challenge from sign-in and password reset in `identity`, and add `completeSecondFactor` with the sign-in lock
- [x] 2.3 Mount the routers and the requirement gate, with schemas and OpenAPI entries
- [x] 2.4 Test enrolment, the code step, trusted addresses, replay, backup codes, the lock, expiry, reset sign-in, turning off, the requirement gate, member and platform resets

## 3. Web

- [x] 3.1 Add dictionary keys
- [x] 3.2 Add the code step to the sign-in and reset pages
- [x] 3.3 Add the two-factor section to the profile settings and the setup screen for a required organization
- [x] 3.4 Add the requirement switch and the reset action to the employee directory, and the reset form to the platform area
- [x] 3.5 Test the code step, enrolment, backup codes, addresses, the forced setup and both resets

## 4. Verify

- [x] 4.1 Run `npm test`, the web suite and the landing suite
