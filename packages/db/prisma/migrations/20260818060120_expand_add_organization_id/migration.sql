/*
  Warnings:

  - The primary key for the `CompanySetting` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[organizationId,date]` on the table `Holiday` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[organizationId,code]` on the table `LeaveTypeConfig` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `organizationId` to the `CompanySetting` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Holiday_date_key";

-- DropIndex
DROP INDEX "LeaveTypeConfig_code_key";

-- AlterTable
ALTER TABLE "Announcement" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "organizationId" TEXT;

-- AlterTable: drop the old primary key and add organizationId as nullable first
ALTER TABLE "CompanySetting" DROP CONSTRAINT "CompanySetting_pkey";
ALTER TABLE "CompanySetting" ADD COLUMN     "organizationId" TEXT;

-- Backfill existing rows to the one organization that exists today
UPDATE "CompanySetting" SET "organizationId" = (SELECT id FROM "Organization" WHERE slug = 'default') WHERE "organizationId" IS NULL;

-- Now it's safe to enforce NOT NULL and re-add the primary key
ALTER TABLE "CompanySetting" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "CompanySetting" ADD CONSTRAINT "CompanySetting_pkey" PRIMARY KEY ("organizationId", "key");

-- AlterTable
ALTER TABLE "Device" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "Holiday" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "JobPosting" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "LeaveTypeConfig" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "PerformanceTemplate" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "ReportExport" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "ScanEvent" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "Shift" ADD COLUMN     "organizationId" TEXT;

-- CreateIndex
CREATE INDEX "Announcement_organizationId_createdAt_idx" ON "Announcement"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "Device_organizationId_status_idx" ON "Device"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Holiday_organizationId_date_key" ON "Holiday"("organizationId", "date");

-- CreateIndex
CREATE INDEX "JobPosting_organizationId_status_createdAt_idx" ON "JobPosting"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveTypeConfig_organizationId_code_key" ON "LeaveTypeConfig"("organizationId", "code");

-- CreateIndex
CREATE INDEX "Notification_organizationId_createdAt_idx" ON "Notification"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "PerformanceTemplate_organizationId_startDate_endDate_idx" ON "PerformanceTemplate"("organizationId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "ReportExport_organizationId_createdAt_idx" ON "ReportExport"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "ScanEvent_organizationId_serverReceivedAt_idx" ON "ScanEvent"("organizationId", "serverReceivedAt");

-- CreateIndex
CREATE INDEX "Shift_organizationId_idx" ON "Shift"("organizationId");

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanEvent" ADD CONSTRAINT "ScanEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportExport" ADD CONSTRAINT "ReportExport_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holiday" ADD CONSTRAINT "Holiday_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanySetting" ADD CONSTRAINT "CompanySetting_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobPosting" ADD CONSTRAINT "JobPosting_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveTypeConfig" ADD CONSTRAINT "LeaveTypeConfig_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceTemplate" ADD CONSTRAINT "PerformanceTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
