-- CreateIndex
CREATE INDEX "Answer_questionId_idx" ON "Answer"("questionId");

-- CreateIndex
CREATE INDEX "CampaignAssignment_campaignId_submittedAt_idx" ON "CampaignAssignment"("campaignId", "submittedAt");

-- CreateIndex
CREATE INDEX "CampaignAssignment_employeeId_idx" ON "CampaignAssignment"("employeeId");
