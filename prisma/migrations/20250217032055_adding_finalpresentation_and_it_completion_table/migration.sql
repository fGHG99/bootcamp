/*
  Warnings:

  - A unique constraint covering the columns `[finalCompletionId]` on the table `Note` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "File" ADD COLUMN     "fpCompletionId" TEXT,
ADD COLUMN     "presentationId" TEXT;

-- AlterTable
ALTER TABLE "Note" ADD COLUMN     "finalCompletionId" TEXT;

-- CreateTable
CREATE TABLE "FinalPresentation" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "description" VARCHAR(300),
    "deadline" TIMESTAMP(3) NOT NULL,
    "batchId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinalPresentation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinalCompletion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "presentationId" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "status" "LessonStatus" NOT NULL DEFAULT 'ASSIGNED',

    CONSTRAINT "FinalCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FinalCompletion_userId_presentationId_key" ON "FinalCompletion"("userId", "presentationId");

-- CreateIndex
CREATE UNIQUE INDEX "Note_finalCompletionId_key" ON "Note"("finalCompletionId");

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_finalCompletionId_fkey" FOREIGN KEY ("finalCompletionId") REFERENCES "FinalCompletion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_presentationId_fkey" FOREIGN KEY ("presentationId") REFERENCES "FinalPresentation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_fpCompletionId_fkey" FOREIGN KEY ("fpCompletionId") REFERENCES "FinalCompletion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalPresentation" ADD CONSTRAINT "FinalPresentation_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalPresentation" ADD CONSTRAINT "FinalPresentation_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalPresentation" ADD CONSTRAINT "FinalPresentation_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalCompletion" ADD CONSTRAINT "FinalCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalCompletion" ADD CONSTRAINT "FinalCompletion_presentationId_fkey" FOREIGN KEY ("presentationId") REFERENCES "FinalPresentation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
