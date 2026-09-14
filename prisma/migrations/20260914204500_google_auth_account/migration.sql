-- CreateTable
CREATE TABLE "GoogleAuthAccount" (
    "id" TEXT NOT NULL DEFAULT 'owner',
    "ownerKey" TEXT NOT NULL,
    "googleSub" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL,
    "name" TEXT,
    "scope" TEXT NOT NULL,
    "tokenPayload" TEXT NOT NULL,
    "refreshPresent" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleAuthAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GoogleAuthAccount_ownerKey_key" ON "GoogleAuthAccount"("ownerKey");

ALTER TABLE "GoogleAuthAccount" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "GoogleAuthAccount" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "GoogleAuthAccount" FROM authenticated;
  END IF;
END $$;
