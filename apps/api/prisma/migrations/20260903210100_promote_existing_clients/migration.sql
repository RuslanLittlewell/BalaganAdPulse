-- Every customer account that exists is the only person on its client, so each
-- is already its principal in everything but name. Without this, a client that
-- registered before this change would have nobody able to add a colleague.
--
-- A separate migration from the one adding the value: Postgres refuses to use a
-- new enum value in the same transaction that created it.
UPDATE "membership" SET "role" = 'CLIENT_ADMIN' WHERE "role" = 'CLIENT';
