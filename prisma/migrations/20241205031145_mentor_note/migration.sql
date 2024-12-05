-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('FOR_GRADER', 'FOR_TRAINEE');

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "content" VARCHAR(300) NOT NULL,
    "visibility" "Visibility" NOT NULL,
    "graderId" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_graderId_fkey" FOREIGN KEY ("graderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
