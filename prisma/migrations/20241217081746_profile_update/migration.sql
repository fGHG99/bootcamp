/*
  Warnings:

  - A unique constraint covering the columns `[userId,type]` on the table `Profile` will be added. If there are existing duplicate values, this will fail.
  - Changed the type of `type` on the `Profile` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "Profile" DROP CONSTRAINT "Profile_userId_fkey";

-- AlterTable
ALTER TABLE "Profile" ALTER COLUMN "mimetype" SET DATA TYPE TEXT,
DROP COLUMN "type",
ADD COLUMN     "type" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Profile_userId_type_key" ON "Profile"("userId", "type");

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
