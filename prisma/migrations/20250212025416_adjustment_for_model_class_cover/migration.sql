-- AlterTable
ALTER TABLE "ClassCover" ALTER COLUMN "filePath" DROP NOT NULL,
ALTER COLUMN "fileName" DROP NOT NULL,
ALTER COLUMN "mimeType" DROP NOT NULL,
ALTER COLUMN "size" DROP NOT NULL;
