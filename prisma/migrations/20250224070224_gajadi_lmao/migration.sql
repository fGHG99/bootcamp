/*
  Warnings:

  - You are about to drop the column `notifExaminer` on the `FinalPresentation` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "FinalPresentation" DROP CONSTRAINT "FinalPresentation_notifExaminer_fkey";

-- AlterTable
ALTER TABLE "FinalPresentation" DROP COLUMN "notifExaminer";
