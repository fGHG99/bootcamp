/*
  Warnings:

  - You are about to drop the column `classId` on the `ChallengeCompletion` table. All the data in the column will be lost.
  - You are about to drop the column `classId` on the `LessonCompletion` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId,challengeId]` on the table `ChallengeCompletion` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,lessonId]` on the table `LessonCompletion` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "ChallengeCompletion" DROP CONSTRAINT "ChallengeCompletion_classId_fkey";

-- DropForeignKey
ALTER TABLE "LessonCompletion" DROP CONSTRAINT "LessonCompletion_classId_fkey";

-- DropIndex
DROP INDEX "ChallengeCompletion_userId_challengeId_classId_key";

-- DropIndex
DROP INDEX "LessonCompletion_userId_lessonId_classId_key";

-- AlterTable
ALTER TABLE "Challenge" ADD COLUMN     "status" "LessonStatus" NOT NULL DEFAULT 'ASSIGNED';

-- AlterTable
ALTER TABLE "ChallengeCompletion" DROP COLUMN "classId";

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "status" "LessonStatus" NOT NULL DEFAULT 'ASSIGNED';

-- AlterTable
ALTER TABLE "LessonCompletion" DROP COLUMN "classId";

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeCompletion_userId_challengeId_key" ON "ChallengeCompletion"("userId", "challengeId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonCompletion_userId_lessonId_key" ON "LessonCompletion"("userId", "lessonId");
