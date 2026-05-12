-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "allowText" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "textRequired" BOOLEAN NOT NULL DEFAULT false;
