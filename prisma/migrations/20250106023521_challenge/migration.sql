/*
  Warnings:

  - You are about to drop the column `challengeId` on the `File` table. All the data in the column will be lost.
  - Added the required column `deadline` to the `Challenge` table without a default value. This is not possible if the table is not empty.
  - Added the required column `description` to the `Challenge` table without a default value. This is not possible if the table is not empty.
  - Added the required column `filepath` to the `Challenge` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mimetype` to the `Challenge` table without a default value. This is not possible if the table is not empty.
  - Added the required column `size` to the `Challenge` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `Challenge` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "File" DROP CONSTRAINT "File_challengeId_fkey";

-- AlterTable
ALTER TABLE "Challenge" ADD COLUMN     "deadline" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "description" VARCHAR(300) NOT NULL,
ADD COLUMN     "filepath" TEXT NOT NULL,
ADD COLUMN     "mimetype" TEXT NOT NULL,
ADD COLUMN     "size" INTEGER NOT NULL,
ADD COLUMN     "status" "LessonStatus" NOT NULL DEFAULT 'NOT_DEADLINE',
ADD COLUMN     "title" VARCHAR(100) NOT NULL;

-- AlterTable
ALTER TABLE "File" DROP COLUMN "challengeId";
