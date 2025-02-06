/*
  Warnings:

  - You are about to drop the column `chCompletionId` on the `File` table. All the data in the column will be lost.
  - You are about to drop the `ChallengeCompletion` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `userId` to the `Challenge` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "ChallengeCompletion" DROP CONSTRAINT "ChallengeCompletion_challengeId_fkey";

-- DropForeignKey
ALTER TABLE "ChallengeCompletion" DROP CONSTRAINT "ChallengeCompletion_classId_fkey";

-- DropForeignKey
ALTER TABLE "ChallengeCompletion" DROP CONSTRAINT "ChallengeCompletion_userId_fkey";

-- DropForeignKey
ALTER TABLE "File" DROP CONSTRAINT "File_chCompletionId_fkey";

-- AlterTable
ALTER TABLE "Challenge" ADD COLUMN     "userId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "File" DROP COLUMN "chCompletionId";

-- DropTable
DROP TABLE "ChallengeCompletion";

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
