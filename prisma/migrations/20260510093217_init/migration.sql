-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'HR');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('RADIO', 'CHECKBOX', 'MCQ_SINGLE', 'MCQ_MULTI', 'TEXT', 'LONG_TEXT');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "Audience" AS ENUM ('ALL', 'SPECIFIC');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "passwordChangedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfficeType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfficeType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "empCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "officeTypeId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "options" JSONB,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "emailSubjectTemplate" TEXT NOT NULL,
    "emailBodyTemplate" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "deadline" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignAssignment" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "emailConfirmCode" TEXT NOT NULL,
    "emailSentAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "confirmAttempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignQuestion" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "audience" "Audience" NOT NULL DEFAULT 'ALL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignQuestionEmployee" (
    "id" TEXT NOT NULL,
    "campaignQuestionId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,

    CONSTRAINT "CampaignQuestionEmployee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Response" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Response_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Answer" (
    "id" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "valueText" TEXT,
    "valueOptions" JSONB,

    CONSTRAINT "Answer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Location_name_key" ON "Location"("name");

-- CreateIndex
CREATE UNIQUE INDEX "OfficeType_name_key" ON "OfficeType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_empCode_key" ON "Employee"("empCode");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_email_key" ON "Employee"("email");

-- CreateIndex
CREATE INDEX "Employee_locationId_idx" ON "Employee"("locationId");

-- CreateIndex
CREATE INDEX "Employee_officeTypeId_idx" ON "Employee"("officeTypeId");

-- CreateIndex
CREATE INDEX "Employee_departmentId_idx" ON "Employee"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignAssignment_token_key" ON "CampaignAssignment"("token");

-- CreateIndex
CREATE INDEX "CampaignAssignment_token_idx" ON "CampaignAssignment"("token");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignAssignment_campaignId_employeeId_key" ON "CampaignAssignment"("campaignId", "employeeId");

-- CreateIndex
CREATE INDEX "CampaignQuestion_campaignId_idx" ON "CampaignQuestion"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignQuestion_campaignId_questionId_key" ON "CampaignQuestion"("campaignId", "questionId");

-- CreateIndex
CREATE INDEX "CampaignQuestionEmployee_employeeId_idx" ON "CampaignQuestionEmployee"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignQuestionEmployee_campaignQuestionId_employeeId_key" ON "CampaignQuestionEmployee"("campaignQuestionId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Response_assignmentId_key" ON "Response"("assignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Answer_responseId_questionId_key" ON "Answer"("responseId", "questionId");

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_officeTypeId_fkey" FOREIGN KEY ("officeTypeId") REFERENCES "OfficeType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignAssignment" ADD CONSTRAINT "CampaignAssignment_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignAssignment" ADD CONSTRAINT "CampaignAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignQuestion" ADD CONSTRAINT "CampaignQuestion_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignQuestion" ADD CONSTRAINT "CampaignQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignQuestionEmployee" ADD CONSTRAINT "CampaignQuestionEmployee_campaignQuestionId_fkey" FOREIGN KEY ("campaignQuestionId") REFERENCES "CampaignQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignQuestionEmployee" ADD CONSTRAINT "CampaignQuestionEmployee_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Response" ADD CONSTRAINT "Response_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "CampaignAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "Response"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
