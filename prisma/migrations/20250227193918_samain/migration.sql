-- DropForeignKey
ALTER TABLE "Challenge" DROP CONSTRAINT "Challenge_batchId_fkey";

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
