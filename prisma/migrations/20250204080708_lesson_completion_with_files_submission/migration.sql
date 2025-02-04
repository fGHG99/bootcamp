-- AlterTable
ALTER TABLE "File" ADD COLUMN     "completionId" TEXT;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_completionId_fkey" FOREIGN KEY ("completionId") REFERENCES "LessonCompletion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
