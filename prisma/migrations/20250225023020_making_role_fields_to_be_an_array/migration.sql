/*
  Warnings:

  - You are about to drop the column `roleId` on the `RoutePermissions` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "RoutePermissions" DROP CONSTRAINT "RoutePermissions_roleId_fkey";

-- AlterTable
ALTER TABLE "RoutePermissions" DROP COLUMN "roleId";

-- CreateTable
CREATE TABLE "_RolesToRoutePermissions" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_RolesToRoutePermissions_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_RolesToRoutePermissions_B_index" ON "_RolesToRoutePermissions"("B");

-- AddForeignKey
ALTER TABLE "_RolesToRoutePermissions" ADD CONSTRAINT "_RolesToRoutePermissions_A_fkey" FOREIGN KEY ("A") REFERENCES "Roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RolesToRoutePermissions" ADD CONSTRAINT "_RolesToRoutePermissions_B_fkey" FOREIGN KEY ("B") REFERENCES "RoutePermissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
