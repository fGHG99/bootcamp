/*
  Warnings:

  - You are about to drop the column `challengeId` on the `Note` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Note" DROP CONSTRAINT "Note_challengeId_fkey";

-- AlterTable
ALTER TABLE "Note" DROP COLUMN "challengeId";
