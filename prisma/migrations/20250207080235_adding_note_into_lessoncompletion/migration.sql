/*
  Warnings:

  - You are about to drop the column `classId` on the `ChallengeCompletion` table. All the data in the column will be lost.
  - You are about to drop the column `classId` on the `LessonCompletion` table. All the data in the column will be lost.
  - You are about to drop the column `lessonId` on the `Note` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "LessonStatus" ADD VALUE 'GRADED';

-- DropForeignKey
ALTER TABLE "ChallengeCompletion" DROP CONSTRAINT "ChallengeCompletion_classId_fkey";

-- DropForeignKey
ALTER TABLE "LessonCompletion" DROP CONSTRAINT "LessonCompletion_classId_fkey";

-- DropForeignKey
ALTER TABLE "Note" DROP CONSTRAINT "Note_lessonId_fkey";

-- AlterTable
ALTER TABLE "ChallengeCompletion" DROP COLUMN "classId";

-- AlterTable
ALTER TABLE "LessonCompletion" DROP COLUMN "classId";

-- AlterTable
ALTER TABLE "Note" DROP COLUMN "lessonId",
ADD COLUMN     "lessonCompletionId" TEXT;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_lessonCompletionId_fkey" FOREIGN KEY ("lessonCompletionId") REFERENCES "LessonCompletion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
