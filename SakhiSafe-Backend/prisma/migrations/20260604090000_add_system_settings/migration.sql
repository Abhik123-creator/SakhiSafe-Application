ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SYSTEM_SETTINGS_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SYSTEM_MAINTENANCE_REQUESTED';

CREATE TABLE "SystemSetting" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "isSensitive" BOOLEAN NOT NULL DEFAULT false,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SystemSetting_key_key" ON "SystemSetting"("key");

ALTER TABLE "SystemSetting"
ADD CONSTRAINT "SystemSetting_updatedById_fkey"
FOREIGN KEY ("updatedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
