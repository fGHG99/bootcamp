-- AlterTable
ALTER TABLE "Note" ADD COLUMN     "batchId" TEXT,
ADD COLUMN     "classId" TEXT;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
