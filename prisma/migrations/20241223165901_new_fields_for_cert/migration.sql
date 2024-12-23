/*
  Warnings:

  - Added the required column `mimetype` to the `Certificate` table without a default value. This is not possible if the table is not empty.
  - Added the required column `size` to the `Certificate` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Certificate" ADD COLUMN     "mimetype" TEXT NOT NULL,
ADD COLUMN     "size" INTEGER NOT NULL;
