-- AlterTable
ALTER TABLE "CampaignQuestion" ADD COLUMN     "groupId" TEXT;

-- CreateTable
CREATE TABLE "CampaignQuestionGroup" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignQuestionGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CampaignQuestionGroup_campaignId_idx" ON "CampaignQuestionGroup"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignQuestionGroup_campaignId_name_key" ON "CampaignQuestionGroup"("campaignId", "name");

-- CreateIndex
CREATE INDEX "CampaignQuestion_groupId_idx" ON "CampaignQuestion"("groupId");

-- AddForeignKey
ALTER TABLE "CampaignQuestionGroup" ADD CONSTRAINT "CampaignQuestionGroup_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignQuestion" ADD CONSTRAINT "CampaignQuestion_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CampaignQuestionGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
