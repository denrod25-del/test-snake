-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "County" AS ENUM ('ORANGE', 'MIAMI_DADE', 'PALM_BEACH', 'MULTI_COUNTY_SEED');

-- CreateEnum
CREATE TYPE "CommentStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "BookingRecord" (
    "id" TEXT NOT NULL,
    "county" "County" NOT NULL,
    "sourceSystem" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "personName" TEXT NOT NULL,
    "bookingDate" TIMESTAMP(3),
    "chargesText" TEXT,
    "mugshotUrl" TEXT,
    "mugshotStorageKey" TEXT,
    "officialSourceUrl" TEXT,
    "rawMetadata" JSONB,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),

    CONSTRAINT "BookingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "bookingRecordId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "CommentStatus" NOT NULL DEFAULT 'pending',
    "moderatedByUserId" TEXT,
    "moderatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL,
    "county" "County" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "recordsUpserted" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookingRecord_county_personName_idx" ON "BookingRecord"("county", "personName");

-- CreateIndex
CREATE INDEX "BookingRecord_bookingDate_idx" ON "BookingRecord"("bookingDate");

-- CreateIndex
CREATE UNIQUE INDEX "BookingRecord_county_sourceSystem_externalId_key" ON "BookingRecord"("county", "sourceSystem", "externalId");

-- CreateIndex
CREATE INDEX "Comment_status_idx" ON "Comment"("status");

-- CreateIndex
CREATE INDEX "Comment_bookingRecordId_idx" ON "Comment"("bookingRecordId");

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_bookingRecordId_fkey" FOREIGN KEY ("bookingRecordId") REFERENCES "BookingRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
