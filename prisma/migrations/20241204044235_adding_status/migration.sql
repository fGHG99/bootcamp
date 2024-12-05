/*
  Warnings:

  - Added the required column `userstatus` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('UNVERIFIED', 'VERIFIED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "userstatus" "UserStatus" NOT NULL;
