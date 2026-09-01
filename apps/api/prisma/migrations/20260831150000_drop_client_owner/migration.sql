-- Ownership is gone. `client.owner_id` survived the two migrations before this
-- one so that the grants could be built from it and proven against it; now that
-- every lookup ends at `client_access`, the column is the last thing still
-- claiming a client belongs to a person.
--
-- This is the one irreversible step of the tenancy move. It is deliberately
-- last, and separate: everything before it can be rolled back by its inverse.

DROP INDEX "client_owner_id_created_at_idx";
ALTER TABLE "client" DROP CONSTRAINT "client_owner_id_fkey";
ALTER TABLE "client" DROP COLUMN "owner_id";
