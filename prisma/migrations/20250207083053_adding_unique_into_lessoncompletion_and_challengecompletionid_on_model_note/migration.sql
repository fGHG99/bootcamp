/*
  Warnings:

  - A unique constraint covering the columns `[lessonCompletionId]` on the table `Note` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[challengeCompletionId]` on the table `Note` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Note_lessonCompletionId_key" ON "Note"("lessonCompletionId");

-- CreateIndex
CREATE UNIQUE INDEX "Note_challengeCompletionId_key" ON "Note"("challengeCompletionId");
