-- CreateEnum
CREATE TYPE "IdeaProjectStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "IdeaProjectVisibility" AS ENUM ('PRIVATE', 'MEMBERS');

-- CreateTable
CREATE TABLE "IdeaProject" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "summary" VARCHAR(280) NOT NULL DEFAULT '',
    "description" VARCHAR(5000) NOT NULL DEFAULT '',
    "neededSkills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "IdeaProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "visibility" "IdeaProjectVisibility" NOT NULL DEFAULT 'PRIVATE',
    "publishedAt" TIMESTAMPTZ(3),
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "IdeaProject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IdeaProject_owner_state_updated_idx" ON "IdeaProject"("ownerId", "status", "updatedAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "IdeaProject_state_visibility_updated_idx" ON "IdeaProject"("status", "visibility", "updatedAt" DESC, "id" DESC);

-- AddForeignKey
ALTER TABLE "IdeaProject" ADD CONSTRAINT "IdeaProject_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "ApplicationUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Record-shape constraints complement the lifecycle policy. Transition history
-- and verified actor checks belong in the future TASK-007 service, not a CHECK.
ALTER TABLE "IdeaProject"
  ADD CONSTRAINT "IdeaProject_title_nonblank_check" CHECK ("title" ~ '[^[:space:]]'),
  ADD CONSTRAINT "IdeaProject_needed_skills_check" CHECK (
    "neededSkills" IS NOT NULL AND cardinality("neededSkills") <= 20
    AND (cardinality("neededSkills") = 0 OR array_ndims("neededSkills") = 1)
    AND array_position("neededSkills", NULL) IS NULL
  ),
  ADD CONSTRAINT "IdeaProject_tags_check" CHECK (
    "tags" IS NOT NULL AND cardinality("tags") <= 20
    AND (cardinality("tags") = 0 OR array_ndims("tags") = 1)
    AND array_position("tags", NULL) IS NULL
  ),
  ADD CONSTRAINT "IdeaProject_state_dates_check" CHECK (
    ("status" = 'DRAFT' AND "publishedAt" IS NULL AND "archivedAt" IS NULL)
    OR ("status" = 'PUBLISHED' AND "publishedAt" IS NOT NULL AND "archivedAt" IS NULL)
    OR ("status" = 'ARCHIVED' AND "archivedAt" IS NOT NULL)
  ),
  ADD CONSTRAINT "IdeaProject_date_order_check" CHECK (
    ("publishedAt" IS NULL OR "publishedAt" >= "createdAt")
    AND ("archivedAt" IS NULL OR "archivedAt" >= "createdAt")
    AND ("publishedAt" IS NULL OR "archivedAt" IS NULL OR "archivedAt" >= "publishedAt")
  );
