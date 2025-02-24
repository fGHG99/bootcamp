/*
  Warnings:

  - Added the required column `notifExaminer` to the `FinalPresentation` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "FinalPresentation" ADD COLUMN     "notifExaminer" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "FinalPresentation" ADD CONSTRAINT "FinalPresentation_notifExaminer_fkey" FOREIGN KEY ("notifExaminer") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
