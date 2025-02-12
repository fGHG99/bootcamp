/*
  Warnings:

  - A unique constraint covering the columns `[userId,challengeId,classId]` on the table `ChallengeCompletion` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,lessonId,classId]` on the table `LessonCompletion` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `classId` to the `ChallengeCompletion` table without a default value. This is not possible if the table is not empty.
  - Added the required column `classId` to the `LessonCompletion` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "ChallengeCompletion_userId_challengeId_key";

-- DropIndex
DROP INDEX "LessonCompletion_userId_lessonId_key";

-- AlterTable
ALTER TABLE "ChallengeCompletion" ADD COLUMN     "classId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "LessonCompletion" ADD COLUMN     "classId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeCompletion_userId_challengeId_classId_key" ON "ChallengeCompletion"("userId", "challengeId", "classId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonCompletion_userId_lessonId_classId_key" ON "LessonCompletion"("userId", "lessonId", "classId");

-- AddForeignKey
ALTER TABLE "ChallengeCompletion" ADD CONSTRAINT "ChallengeCompletion_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonCompletion" ADD CONSTRAINT "LessonCompletion_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
