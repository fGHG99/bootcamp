-- DropForeignKey
ALTER TABLE "Challenge" DROP CONSTRAINT "Challenge_classId_fkey";

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
