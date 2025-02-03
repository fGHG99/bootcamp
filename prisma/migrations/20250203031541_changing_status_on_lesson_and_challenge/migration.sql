/*
  Warnings:

  - The values [NOT_DEADLINE,DEADLINE] on the enum `LessonStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "LessonStatus_new" AS ENUM ('ASSIGNED', 'NOTSUBMITTED', 'SUBMITTED');
ALTER TABLE "Challenge" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Lesson" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Challenge" ALTER COLUMN "status" TYPE "LessonStatus_new" USING ("status"::text::"LessonStatus_new");
ALTER TABLE "Lesson" ALTER COLUMN "status" TYPE "LessonStatus_new" USING ("status"::text::"LessonStatus_new");
ALTER TYPE "LessonStatus" RENAME TO "LessonStatus_old";
ALTER TYPE "LessonStatus_new" RENAME TO "LessonStatus";
DROP TYPE "LessonStatus_old";
ALTER TABLE "Challenge" ALTER COLUMN "status" SET DEFAULT 'ASSIGNED';
ALTER TABLE "Lesson" ALTER COLUMN "status" SET DEFAULT 'ASSIGNED';
COMMIT;

-- AlterTable
ALTER TABLE "Challenge" ALTER COLUMN "status" SET DEFAULT 'ASSIGNED';

-- AlterTable
ALTER TABLE "Lesson" ALTER COLUMN "status" SET DEFAULT 'ASSIGNED';
