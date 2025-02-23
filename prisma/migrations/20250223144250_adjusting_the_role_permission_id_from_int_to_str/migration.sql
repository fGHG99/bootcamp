/*
  Warnings:

  - The primary key for the `Roles` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `RoutePermissions` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[route]` on the table `RoutePermissions` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "RoutePermissions" DROP CONSTRAINT "RoutePermissions_roleId_fkey";

-- AlterTable
ALTER TABLE "Roles" DROP CONSTRAINT "Roles_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "Roles_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Roles_id_seq";

-- AlterTable
ALTER TABLE "RoutePermissions" DROP CONSTRAINT "RoutePermissions_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "roleId" SET DATA TYPE TEXT,
ADD CONSTRAINT "RoutePermissions_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "RoutePermissions_id_seq";

-- CreateIndex
CREATE UNIQUE INDEX "RoutePermissions_route_key" ON "RoutePermissions"("route");

-- AddForeignKey
ALTER TABLE "RoutePermissions" ADD CONSTRAINT "RoutePermissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
