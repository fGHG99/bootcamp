/*
  Warnings:

  - You are about to drop the column `batchId` on the `Class` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Class" DROP CONSTRAINT "Class_batchId_fkey";

-- AlterTable
ALTER TABLE "Class" DROP COLUMN "batchId";

-- CreateTable
CREATE TABLE "BatchClass" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,

    CONSTRAINT "BatchClass_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BatchClass_batchId_classId_key" ON "BatchClass"("batchId", "classId");

-- AddForeignKey
ALTER TABLE "BatchClass" ADD CONSTRAINT "BatchClass_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchClass" ADD CONSTRAINT "BatchClass_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
