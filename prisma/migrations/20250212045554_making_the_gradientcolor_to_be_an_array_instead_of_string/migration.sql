/*
  Warnings:

  - The `gradientColors` column on the `ClassCover` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "ClassCover" DROP COLUMN "gradientColors",
ADD COLUMN     "gradientColors" TEXT[];
