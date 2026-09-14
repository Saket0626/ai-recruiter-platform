-- CreateTable
CREATE TABLE "Professor" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "title" TEXT,
    "department" TEXT,
    "university" TEXT NOT NULL,
    "email" TEXT,
    "emailNormalized" TEXT,
    "emailSourceUrl" TEXT,
    "facultyPageUrl" TEXT,
    "facultyPageUrlNormalized" TEXT,
    "labUrl" TEXT,
    "personalWebsite" TEXT,
    "researchTopics" TEXT NOT NULL DEFAULT '[]',
    "researchSummary" TEXT,
    "currentProjects" TEXT NOT NULL DEFAULT '[]',
    "relevanceScore" INTEGER,
    "relevanceExplanation" TEXT,
    "scoringFactors" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL,
    "insufficientEvidence" BOOLEAN NOT NULL DEFAULT false,
    "genericInbox" BOOLEAN NOT NULL DEFAULT false,
    "identityKey" TEXT NOT NULL,
    "lastContactedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Professor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchEvidence" (
    "id" TEXT NOT NULL,
    "professorId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "extractedText" TEXT NOT NULL,
    "claim" TEXT NOT NULL,
    "sourcePriority" INTEGER NOT NULL,
    "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailDraft" (
    "id" TEXT NOT NULL,
    "professorId" TEXT NOT NULL,
    "discoveryRunId" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "validationErrors" TEXT NOT NULL DEFAULT '[]',
    "validationPassed" BOOLEAN NOT NULL DEFAULT false,
    "personalizedTopics" TEXT NOT NULL DEFAULT '[]',
    "studentClaims" TEXT NOT NULL DEFAULT '[]',
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "EmailDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailSend" (
    "id" TEXT NOT NULL,
    "professorId" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "recipientNormalized" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "failureReason" TEXT,
    "graphStatus" TEXT,
    "dryRun" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "EmailSend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "DiscoveryRun" (
    "id" TEXT NOT NULL,
    "university" TEXT NOT NULL,
    "universitiesJson" TEXT NOT NULL DEFAULT '[]',
    "department" TEXT,
    "universityDomain" TEXT,
    "seedUrls" TEXT NOT NULL DEFAULT '[]',
    "researchInterests" TEXT NOT NULL DEFAULT '[]',
    "maxCandidates" INTEGER NOT NULL,
    "minScore" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "currentStage" TEXT NOT NULL,
    "progressJson" TEXT NOT NULL DEFAULT '{}',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscoveryRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageCache" (
    "url" TEXT NOT NULL,
    "contentType" TEXT,
    "body" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageCache_pkey" PRIMARY KEY ("url")
);

-- CreateTable
CREATE TABLE "AuthAccount" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "homeAccountId" TEXT,
    "username" TEXT,
    "name" TEXT,
    "tokenCache" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Professor_identityKey_key" ON "Professor"("identityKey");

-- CreateIndex
CREATE INDEX "Professor_emailNormalized_idx" ON "Professor"("emailNormalized");

-- CreateIndex
CREATE INDEX "Professor_facultyPageUrlNormalized_idx" ON "Professor"("facultyPageUrlNormalized");

-- CreateIndex
CREATE INDEX "Professor_university_fullName_idx" ON "Professor"("university", "fullName");

-- CreateIndex
CREATE INDEX "Professor_status_idx" ON "Professor"("status");

-- CreateIndex
CREATE INDEX "ResearchEvidence_professorId_idx" ON "ResearchEvidence"("professorId");

-- CreateIndex
CREATE INDEX "EmailDraft_status_idx" ON "EmailDraft"("status");

-- CreateIndex
CREATE INDEX "EmailDraft_professorId_idx" ON "EmailDraft"("professorId");

-- CreateIndex
CREATE INDEX "EmailSend_recipientNormalized_sentAt_idx" ON "EmailSend"("recipientNormalized", "sentAt");

-- CreateIndex
CREATE INDEX "EmailSend_status_idx" ON "EmailSend"("status");

-- AddForeignKey
ALTER TABLE "ResearchEvidence" ADD CONSTRAINT "ResearchEvidence_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "Professor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailDraft" ADD CONSTRAINT "EmailDraft_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "Professor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailDraft" ADD CONSTRAINT "EmailDraft_discoveryRunId_fkey" FOREIGN KEY ("discoveryRunId") REFERENCES "DiscoveryRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailSend" ADD CONSTRAINT "EmailSend_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "Professor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailSend" ADD CONSTRAINT "EmailSend_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "EmailDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

