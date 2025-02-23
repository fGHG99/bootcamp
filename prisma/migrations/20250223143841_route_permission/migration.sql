-- CreateTable
CREATE TABLE "RoutePermissions" (
    "id" SERIAL NOT NULL,
    "route" TEXT NOT NULL,
    "roleId" INTEGER NOT NULL,

    CONSTRAINT "RoutePermissions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "RoutePermissions" ADD CONSTRAINT "RoutePermissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
