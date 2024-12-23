-- AlterTable
ALTER TABLE "Class" ALTER COLUMN "participant" SET DEFAULT 0;

-- CreateTable
CREATE TABLE "_UserClasses" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_UserClasses_AB_unique" ON "_UserClasses"("A", "B");

-- CreateIndex
CREATE INDEX "_UserClasses_B_index" ON "_UserClasses"("B");

-- AddForeignKey
ALTER TABLE "_UserClasses" ADD CONSTRAINT "_UserClasses_A_fkey" FOREIGN KEY ("A") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserClasses" ADD CONSTRAINT "_UserClasses_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
