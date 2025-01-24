-- AlterTable
ALTER TABLE "ChallengeCompletion" ADD COLUMN     "classId" TEXT;

-- AlterTable
ALTER TABLE "LessonCompletion" ALTER COLUMN "classId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "ChallengeCompletion" ADD CONSTRAINT "ChallengeCompletion_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
