-- CreateTable
CREATE TABLE "_ClassMentors" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_ClassMentors_AB_unique" ON "_ClassMentors"("A", "B");

-- CreateIndex
CREATE INDEX "_ClassMentors_B_index" ON "_ClassMentors"("B");

-- AddForeignKey
ALTER TABLE "_ClassMentors" ADD CONSTRAINT "_ClassMentors_A_fkey" FOREIGN KEY ("A") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ClassMentors" ADD CONSTRAINT "_ClassMentors_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
