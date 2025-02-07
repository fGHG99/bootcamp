-- DropForeignKey
ALTER TABLE "Note" DROP CONSTRAINT "Note_classId_fkey";

-- AlterTable
ALTER TABLE "Note" ALTER COLUMN "classId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;
