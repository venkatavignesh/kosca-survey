-- AlterTable
ALTER TABLE "CampaignAssignment" ADD COLUMN     "confirmCodeSentAt" TIMESTAMP(3),
ALTER COLUMN "emailConfirmCode" DROP NOT NULL;
