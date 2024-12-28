/*
  Warnings:

  - You are about to drop the column `mentorId` on the `Batch` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Batch" DROP CONSTRAINT "Batch_mentorId_fkey";

-- AlterTable
ALTER TABLE "Batch" DROP COLUMN "mentorId";

-- CreateTable
CREATE TABLE "_BatchMentors" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_BatchMentors_AB_unique" ON "_BatchMentors"("A", "B");

-- CreateIndex
CREATE INDEX "_BatchMentors_B_index" ON "_BatchMentors"("B");

-- AddForeignKey
ALTER TABLE "_BatchMentors" ADD CONSTRAINT "_BatchMentors_A_fkey" FOREIGN KEY ("A") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BatchMentors" ADD CONSTRAINT "_BatchMentors_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
