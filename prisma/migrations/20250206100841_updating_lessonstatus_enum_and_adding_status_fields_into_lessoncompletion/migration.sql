-- AlterEnum
ALTER TYPE "LessonStatus" ADD VALUE 'LATE';

-- AlterTable
ALTER TABLE "LessonCompletion" ADD COLUMN     "status" "LessonStatus" NOT NULL DEFAULT 'ASSIGNED';
