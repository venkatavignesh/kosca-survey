-- AlterTable
ALTER TABLE "CampaignAssignment" ADD COLUMN     "lastAutoReminderAt" TIMESTAMP(3),
ADD COLUMN     "lastReminderSentAt" TIMESTAMP(3),
ADD COLUMN     "reminderCount" INTEGER NOT NULL DEFAULT 0;
