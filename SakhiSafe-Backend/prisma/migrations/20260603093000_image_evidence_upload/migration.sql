-- CreateEnum
CREATE TYPE "EvidenceSource" AS ENUM ('WHATSAPP', 'WEB', 'ADMIN');

-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('IMAGE');

-- CreateEnum
CREATE TYPE "EvidenceUploadedBy" AS ENUM ('CARE_SEEKER', 'ADMIN', 'AI_SERVICE');

-- CreateEnum
CREATE TYPE "EvidenceStatus" AS ENUM ('ACTIVE', 'DELETED');

-- AlterEnum
ALTER TYPE "ConversationMessageType" ADD VALUE IF NOT EXISTS 'IMAGE';

-- AlterTable
ALTER TABLE "ConversationMessage"
ADD COLUMN "mediaId" TEXT,
ADD COLUMN "evidenceId" UUID,
ALTER COLUMN "messageText" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Evidence" (
    "id" UUID NOT NULL,
    "careSeekerId" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "incidentId" UUID NOT NULL,
    "source" "EvidenceSource" NOT NULL,
    "evidenceType" "EvidenceType" NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "storedFileName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "sha256Hash" TEXT,
    "caption" TEXT,
    "description" TEXT,
    "uploadedBy" "EvidenceUploadedBy" NOT NULL,
    "status" "EvidenceStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Evidence_incidentId_status_idx" ON "Evidence"("incidentId", "status");

-- CreateIndex
CREATE INDEX "Evidence_careSeekerId_sessionId_incidentId_idx" ON "Evidence"("careSeekerId", "sessionId", "incidentId");

-- AddForeignKey
ALTER TABLE "ConversationMessage" ADD CONSTRAINT "ConversationMessage_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_careSeekerId_fkey" FOREIGN KEY ("careSeekerId") REFERENCES "CareSeeker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ConversationSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
