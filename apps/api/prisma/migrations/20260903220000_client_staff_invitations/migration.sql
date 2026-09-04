-- A third kind of invitation: joining a client that already exists, rather than
-- creating one. It carries no role — whoever redeems it becomes an ordinary
-- CLIENT of the client it names.
ALTER TYPE "registration_type" ADD VALUE 'CLIENT_STAFF';

-- Set for that kind alone. The other two either create a client or have nothing
-- to do with one, so every existing invitation keeps a null here.
ALTER TABLE "invite" ADD COLUMN "client_id" TEXT;

-- The invitation goes with the client it joins: a client that is deleted takes
-- its outstanding invitations with it, since there is nothing left to join.
ALTER TABLE "invite"
  ADD CONSTRAINT "invite_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "client"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "invite_client_id_idx" ON "invite"("client_id");
