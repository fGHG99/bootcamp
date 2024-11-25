-- CreateEnum
CREATE TYPE "Role" AS ENUM ('TRAINEE', 'MENTOR', 'EXAMINER', 'ADMIN');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "fullName" VARCHAR(50) NOT NULL,
    "nickname" TEXT NOT NULL,
    "pob" VARCHAR(30) NOT NULL,
    "dob" TIMESTAMP(3) NOT NULL,
    "address" TEXT NOT NULL,
    "mobile" VARCHAR(15) NOT NULL,
    "lastEdu" TEXT NOT NULL,
    "lastEduInst" TEXT NOT NULL,
    "major" TEXT,
    "inCollege" BOOLEAN NOT NULL,
    "college" TEXT,
    "currentMajor" TEXT,
    "github" TEXT,
    "skill1" INTEGER NOT NULL,
    "skill2" INTEGER NOT NULL,
    "skill3" INTEGER NOT NULL,
    "skill4" INTEGER NOT NULL,
    "skill5" INTEGER NOT NULL,
    "skill6" INTEGER NOT NULL,
    "skill7" INTEGER NOT NULL,
    "skill8" INTEGER NOT NULL,
    "confident" VARCHAR(300) NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Token" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Token_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Token" ADD CONSTRAINT "Token_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
