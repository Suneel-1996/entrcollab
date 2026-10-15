-- CreateEnum
CREATE TYPE "ProfileFieldVisibility" AS ENUM ('PRIVATE', 'MEMBERS');

-- CreateTable
CREATE TABLE "Profile" (
    "userId" UUID NOT NULL,
    "displayName" VARCHAR(80) NOT NULL,
    "bio" VARCHAR(2000) NOT NULL DEFAULT '',
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "interests" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "availability" VARCHAR(200) NOT NULL DEFAULT '',
    "displayNameVisibility" "ProfileFieldVisibility" NOT NULL DEFAULT 'PRIVATE',
    "bioVisibility" "ProfileFieldVisibility" NOT NULL DEFAULT 'PRIVATE',
    "skillsVisibility" "ProfileFieldVisibility" NOT NULL DEFAULT 'PRIVATE',
    "interestsVisibility" "ProfileFieldVisibility" NOT NULL DEFAULT 'PRIVATE',
    "availabilityVisibility" "ProfileFieldVisibility" NOT NULL DEFAULT 'PRIVATE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "ApplicationUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

