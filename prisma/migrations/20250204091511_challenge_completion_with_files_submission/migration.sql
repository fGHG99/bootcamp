-- AlterTable
ALTER TABLE "File" ADD COLUMN     "chCompletionId" TEXT;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_chCompletionId_fkey" FOREIGN KEY ("chCompletionId") REFERENCES "ChallengeCompletion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
