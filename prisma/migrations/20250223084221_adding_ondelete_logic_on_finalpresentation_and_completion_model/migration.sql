-- DropForeignKey
ALTER TABLE "FinalCompletion" DROP CONSTRAINT "FinalCompletion_presentationId_fkey";

-- DropForeignKey
ALTER TABLE "FinalCompletion" DROP CONSTRAINT "FinalCompletion_userId_fkey";

-- DropForeignKey
ALTER TABLE "FinalPresentation" DROP CONSTRAINT "FinalPresentation_batchId_fkey";

-- DropForeignKey
ALTER TABLE "FinalPresentation" DROP CONSTRAINT "FinalPresentation_classId_fkey";

-- DropForeignKey
ALTER TABLE "FinalPresentation" DROP CONSTRAINT "FinalPresentation_mentorId_fkey";

-- AddForeignKey
ALTER TABLE "FinalPresentation" ADD CONSTRAINT "FinalPresentation_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalPresentation" ADD CONSTRAINT "FinalPresentation_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalPresentation" ADD CONSTRAINT "FinalPresentation_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalCompletion" ADD CONSTRAINT "FinalCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalCompletion" ADD CONSTRAINT "FinalCompletion_presentationId_fkey" FOREIGN KEY ("presentationId") REFERENCES "FinalPresentation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
