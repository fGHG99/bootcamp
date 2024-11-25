/*
  Warnings:

  - Added the required column `role` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `status` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" VARCHAR(10) NOT NULL,
ADD COLUMN     "status" VARCHAR(10) NOT NULL,
ALTER COLUMN "fullName" DROP NOT NULL,
ALTER COLUMN "nickname" DROP NOT NULL,
ALTER COLUMN "pob" DROP NOT NULL,
ALTER COLUMN "dob" DROP NOT NULL,
ALTER COLUMN "address" DROP NOT NULL,
ALTER COLUMN "mobile" DROP NOT NULL,
ALTER COLUMN "lastEdu" DROP NOT NULL,
ALTER COLUMN "lastEduInst" DROP NOT NULL,
ALTER COLUMN "skill1" DROP NOT NULL,
ALTER COLUMN "skill2" DROP NOT NULL,
ALTER COLUMN "skill3" DROP NOT NULL,
ALTER COLUMN "skill4" DROP NOT NULL,
ALTER COLUMN "skill5" DROP NOT NULL,
ALTER COLUMN "skill6" DROP NOT NULL,
ALTER COLUMN "skill7" DROP NOT NULL,
ALTER COLUMN "skill8" DROP NOT NULL,
ALTER COLUMN "confident" DROP NOT NULL;
