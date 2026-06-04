-- Store only a keyed hash of each non-admin user's evidence/PDF access code.
ALTER TABLE "User"
  ADD COLUMN "evidenceAccessCodeHash" TEXT,
  ADD COLUMN "evidenceAccessCodeIssuedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_evidenceAccessCodeHash_key" ON "User"("evidenceAccessCodeHash");
