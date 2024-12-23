/*
  Warnings:

  - You are about to drop the column `batchId` on the `User` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_batchId_fkey";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "batchId";

-- CreateTable
CREATE TABLE "_BatchParticipants" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_BatchParticipants_AB_unique" ON "_BatchParticipants"("A", "B");

-- CreateIndex
CREATE INDEX "_BatchParticipants_B_index" ON "_BatchParticipants"("B");

-- AddForeignKey
ALTER TABLE "_BatchParticipants" ADD CONSTRAINT "_BatchParticipants_A_fkey" FOREIGN KEY ("A") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BatchParticipants" ADD CONSTRAINT "_BatchParticipants_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
