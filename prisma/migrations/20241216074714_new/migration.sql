/*
  Warnings:

  - Changed the type of `type` on the `Profile` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "ProfileType" AS ENUM ('CASUAL', 'PROFESSIONAL');

-- AlterTable
ALTER TABLE "Profile" DROP COLUMN "type",
ADD COLUMN     "type" "ProfileType" NOT NULL;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "refreshToken" DROP NOT NULL;
