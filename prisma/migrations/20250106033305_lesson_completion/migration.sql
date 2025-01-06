/*
  Warnings:

  - A unique constraint covering the columns `[userId,lessonId]` on the table `LessonCompletion` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "LessonCompletion_userId_lessonId_key" ON "LessonCompletion"("userId", "lessonId");
