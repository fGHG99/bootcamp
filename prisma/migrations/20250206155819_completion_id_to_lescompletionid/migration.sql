/*
  Warnings:

  - You are about to drop the column `completionId` on the `File` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "File" DROP CONSTRAINT "File_chCompletionId_fkey";

-- DropForeignKey
ALTER TABLE "File" DROP CONSTRAINT "File_completionId_fkey";

-- AlterTable
ALTER TABLE "File" DROP COLUMN "completionId",
ADD COLUMN     "lesCompletionId" TEXT;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_lesCompletionId_fkey" FOREIGN KEY ("lesCompletionId") REFERENCES "LessonCompletion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_chCompletionId_fkey" FOREIGN KEY ("chCompletionId") REFERENCES "ChallengeCompletion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
