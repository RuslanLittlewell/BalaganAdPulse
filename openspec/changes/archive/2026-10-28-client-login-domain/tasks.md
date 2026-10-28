## 1. Login shape

- [x] 1.1 Generate logins ending with `@balagan.pro`
- [x] 1.2 Treat a login equal to an existing account's email as taken
- [x] 1.3 Add a data migration appending the ending to stored logins without an `@`

## 2. Sign-in

- [x] 2.1 Look a sign-in value up by login first, then by email, and drop the shape rule

## 3. Tests and docs

- [x] 3.1 Cover the login shape, the email collision and sign-in with a full login
- [x] 3.2 Update fixtures that show a login, README and the API description
