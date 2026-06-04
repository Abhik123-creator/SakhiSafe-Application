-- CreateEnum
CREATE TYPE "EvidenceAiAnalysisStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- AlterEnum
ALTER TYPE "EvidenceSource" ADD VALUE IF NOT EXISTS 'ADMIN_UPLOAD';
ALTER TYPE "EvidenceSource" ADD VALUE IF NOT EXISTS 'AI_SERVICE';

-- AlterEnum
ALTER TYPE "EvidenceType" ADD VALUE IF NOT EXISTS 'AUDIO';
ALTER TYPE "EvidenceType" ADD VALUE IF NOT EXISTS 'VIDEO';
ALTER TYPE "EvidenceType" ADD VALUE IF NOT EXISTS 'DOCUMENT';
ALTER TYPE "EvidenceType" ADD VALUE IF NOT EXISTS 'TEXT';

-- AlterTable
ALTER TABLE "Case" ADD COLUMN "confidenceScore" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Incident" ADD COLUMN "confidenceScore" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Evidence"
ADD COLUMN "caseId" UUID,
ADD COLUMN "publicUrl" TEXT,
ADD COLUMN "whatsappMessageId" TEXT,
ADD COLUMN "whatsappMediaId" TEXT,
ADD COLUMN "aiAnalysisStatus" "EvidenceAiAnalysisStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "aiAnalysisJson" JSONB,
ADD COLUMN "aiConfidence" DOUBLE PRECISION,
ADD COLUMN "aiSummary" TEXT,
ALTER COLUMN "sessionId" DROP NOT NULL,
ALTER COLUMN "incidentId" DROP NOT NULL,
ALTER COLUMN "originalFileName" DROP NOT NULL;

-- CreateTable
CREATE TABLE "CaseNote" (
    "id" UUID NOT NULL,
    "careSeekerId" UUID NOT NULL,
    "incidentId" UUID,
    "caseId" UUID,
    "noteText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Evidence_caseId_status_idx" ON "Evidence"("caseId", "status");

-- CreateIndex
CREATE INDEX "Evidence_whatsappMessageId_idx" ON "Evidence"("whatsappMessageId");

-- CreateIndex
CREATE INDEX "CaseNote_incidentId_idx" ON "CaseNote"("incidentId");

-- CreateIndex
CREATE INDEX "CaseNote_caseId_idx" ON "CaseNote"("caseId");

-- CreateIndex
CREATE INDEX "CaseNote_careSeekerId_idx" ON "CaseNote"("careSeekerId");

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseNote" ADD CONSTRAINT "CaseNote_careSeekerId_fkey" FOREIGN KEY ("careSeekerId") REFERENCES "CareSeeker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseNote" ADD CONSTRAINT "CaseNote_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseNote" ADD CONSTRAINT "CaseNote_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE SET NULL ON UPDATE CASCADE;
