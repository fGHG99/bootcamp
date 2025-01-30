/*
  Warnings:

  - You are about to drop the column `filepath` on the `Challenge` table. All the data in the column will be lost.
  - You are about to drop the column `mimetype` on the `Challenge` table. All the data in the column will be lost.
  - You are about to drop the column `size` on the `Challenge` table. All the data in the column will be lost.
  - Added the required column `challengeId` to the `File` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Challenge" DROP COLUMN "filepath",
DROP COLUMN "mimetype",
DROP COLUMN "size";

-- AlterTable
ALTER TABLE "File" ADD COLUMN     "challengeId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
