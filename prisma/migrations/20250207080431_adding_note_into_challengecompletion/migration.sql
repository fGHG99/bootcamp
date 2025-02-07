-- AlterTable
ALTER TABLE "Note" ADD COLUMN     "challengeCompletionId" TEXT;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_challengeCompletionId_fkey" FOREIGN KEY ("challengeCompletionId") REFERENCES "ChallengeCompletion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
