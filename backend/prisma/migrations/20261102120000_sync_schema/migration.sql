-- Brings the database in line with schema.prisma.
-- The previous migration was generated from an older schema
-- (typo "lattitude", "minLeaseDuration", no city/address, required deposit),
-- and Preferences/Booking were never captured in a migration file.

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED');

-- AlterTable: Listing
ALTER TABLE "Listing" RENAME COLUMN "lattitude" TO "latitude";
ALTER TABLE "Listing" RENAME COLUMN "minLeaseDuration" TO "minLeaseMonths";
ALTER TABLE "Listing" ALTER COLUMN "depositAmount" DROP NOT NULL;
-- DEFAULT '' only so the statement works if rows already exist, then dropped
ALTER TABLE "Listing" ADD COLUMN "city" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Listing" ALTER COLUMN "city" DROP DEFAULT;
ALTER TABLE "Listing" ADD COLUMN "address" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Listing" ALTER COLUMN "address" DROP DEFAULT;
ALTER TABLE "Listing" ADD COLUMN "neighborhood" TEXT;
ALTER TABLE "Listing" ADD COLUMN "remoteWorkFriendly" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "wantsPetsAllowed" BOOLEAN NOT NULL DEFAULT false,
    "wantsSmokingAllowed" BOOLEAN NOT NULL DEFAULT false,
    "wantsRemoteWork" BOOLEAN NOT NULL DEFAULT false,
    "desiredPropertyType" "PropertyType",
    "desiredCity" TEXT,
    "desiredNeighborhood" TEXT,
    "moveInDate" TIMESTAMP(3),
    "maxPrice" DECIMAL(10,2),
    "minPrice" DECIMAL(10,2),
    "minArea" DOUBLE PRECISION,
    "maxArea" DOUBLE PRECISION,
    "minRooms" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "viewingDate" TIMESTAMP(3) NOT NULL,
    "comment" TEXT,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "listingId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Preferences_userId_key" ON "Preferences"("userId");
CREATE INDEX "Listing_city_status_idx" ON "Listing"("city", "status");
CREATE INDEX "Listing_price_idx" ON "Listing"("price");
CREATE INDEX "Booking_listingId_idx" ON "Booking"("listingId");
CREATE INDEX "Booking_tenantId_idx" ON "Booking"("tenantId");

-- AddForeignKey
ALTER TABLE "Preferences" ADD CONSTRAINT "Preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
