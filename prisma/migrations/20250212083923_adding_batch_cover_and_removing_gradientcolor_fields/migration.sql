/*
  Warnings:

  - You are about to drop the column `gradientColors` on the `ClassCover` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ClassCover" DROP COLUMN "gradientColors";

-- CreateTable
CREATE TABLE "BatchCover" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "filePath" TEXT,
    "fileName" TEXT,
    "mimeType" TEXT,
    "size" INTEGER,

    CONSTRAINT "BatchCover_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BatchCover_batchId_key" ON "BatchCover"("batchId");

-- AddForeignKey
ALTER TABLE "BatchCover" ADD CONSTRAINT "BatchCover_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
