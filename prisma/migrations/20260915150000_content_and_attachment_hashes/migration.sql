-- AlterTable
ALTER TABLE "EmailDraft" ADD COLUMN IF NOT EXISTS "contentSha256" TEXT;

-- AlterTable
ALTER TABLE "EmailSend" ADD COLUMN IF NOT EXISTS "attachmentSha256" TEXT;
