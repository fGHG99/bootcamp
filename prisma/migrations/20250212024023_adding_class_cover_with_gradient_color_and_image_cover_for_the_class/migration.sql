-- CreateTable
CREATE TABLE "ClassCover" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "gradientColors" TEXT,
    "filePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,

    CONSTRAINT "ClassCover_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClassCover_classId_key" ON "ClassCover"("classId");

-- AddForeignKey
ALTER TABLE "ClassCover" ADD CONSTRAINT "ClassCover_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
