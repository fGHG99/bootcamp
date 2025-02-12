/*
  Warnings:

  - You are about to drop the column `status` on the `Challenge` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Lesson` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Challenge" DROP COLUMN "status";

-- AlterTable
ALTER TABLE "Lesson" DROP COLUMN "status";

-- AlterTable
ALTER TABLE "_BatchMentors" ADD CONSTRAINT "_BatchMentors_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_BatchMentors_AB_unique";

-- AlterTable
ALTER TABLE "_BatchParticipants" ADD CONSTRAINT "_BatchParticipants_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_BatchParticipants_AB_unique";

-- AlterTable
ALTER TABLE "_ClassMentors" ADD CONSTRAINT "_ClassMentors_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_ClassMentors_AB_unique";

-- AlterTable
ALTER TABLE "_UserClasses" ADD CONSTRAINT "_UserClasses_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_UserClasses_AB_unique";
