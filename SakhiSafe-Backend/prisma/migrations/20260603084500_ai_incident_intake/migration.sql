-- CreateEnum
CREATE TYPE "CareSeekerSource" AS ENUM ('WHATSAPP', 'WEB', 'ADMIN');

-- CreateEnum
CREATE TYPE "CareSeekerStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "ConversationChannel" AS ENUM ('WHATSAPP', 'WEB');

-- CreateEnum
CREATE TYPE "ConversationSessionStatus" AS ENUM ('ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "ConversationDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "ConversationMessageType" AS ENUM ('TEXT');

-- CreateEnum
CREATE TYPE "IncidentSource" AS ENUM ('WHATSAPP', 'WEB', 'ADMIN');

-- CreateEnum
CREATE TYPE "IncidentCategory" AS ENUM ('DOMESTIC_VIOLENCE', 'PHYSICAL_ABUSE', 'EMOTIONAL_ABUSE', 'SEXUAL_ABUSE', 'FINANCIAL_ABUSE', 'STALKING', 'HARASSMENT', 'THREAT', 'OTHER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "IncidentUrgency" AS ENUM ('LOW', 'SOON', 'URGENT', 'IMMEDIATE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('DRAFT', 'OPEN', 'UNDER_REVIEW', 'CLOSED');

-- AlterTable
ALTER TABLE "CareSeeker"
ADD COLUMN "displayName" TEXT,
ADD COLUMN "phoneNumber" TEXT,
ADD COLUMN "whatsappPhoneNumber" TEXT,
ADD COLUMN "source" "CareSeekerSource" NOT NULL DEFAULT 'ADMIN',
ADD COLUMN "status" "CareSeekerStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "ConversationSession" (
    "id" UUID NOT NULL,
    "careSeekerId" UUID NOT NULL,
    "channel" "ConversationChannel" NOT NULL,
    "status" "ConversationSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationMessage" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "direction" "ConversationDirection" NOT NULL,
    "messageType" "ConversationMessageType" NOT NULL,
    "messageText" TEXT NOT NULL,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" UUID NOT NULL,
    "careSeekerId" UUID NOT NULL,
    "sessionId" UUID,
    "source" "IncidentSource" NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "description" TEXT,
    "category" "IncidentCategory" NOT NULL DEFAULT 'UNKNOWN',
    "severity" "IncidentSeverity" NOT NULL DEFAULT 'UNKNOWN',
    "urgency" "IncidentUrgency" NOT NULL DEFAULT 'UNKNOWN',
    "incidentDateText" TEXT,
    "locationText" TEXT,
    "perpetratorRelation" TEXT,
    "riskSignals" JSONB,
    "missingFields" JSONB,
    "needsHumanReview" BOOLEAN NOT NULL DEFAULT false,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "aiConfidence" DECIMAL(4,3),
    "caseNote" TEXT,
    "status" "IncidentStatus" NOT NULL DEFAULT 'DRAFT',
    "manuallyEdited" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CareSeeker_phoneNumber_key" ON "CareSeeker"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CareSeeker_whatsappPhoneNumber_key" ON "CareSeeker"("whatsappPhoneNumber");

-- CreateIndex
CREATE INDEX "ConversationSession_careSeekerId_channel_status_idx" ON "ConversationSession"("careSeekerId", "channel", "status");

-- CreateIndex
CREATE INDEX "ConversationMessage_sessionId_createdAt_idx" ON "ConversationMessage"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "Incident_sessionId_status_idx" ON "Incident"("sessionId", "status");

-- CreateIndex
CREATE INDEX "Incident_status_severity_urgency_source_needsHumanReview_idx" ON "Incident"("status", "severity", "urgency", "source", "needsHumanReview");

-- AddForeignKey
ALTER TABLE "ConversationSession" ADD CONSTRAINT "ConversationSession_careSeekerId_fkey" FOREIGN KEY ("careSeekerId") REFERENCES "CareSeeker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMessage" ADD CONSTRAINT "ConversationMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ConversationSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_careSeekerId_fkey" FOREIGN KEY ("careSeekerId") REFERENCES "CareSeeker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ConversationSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
