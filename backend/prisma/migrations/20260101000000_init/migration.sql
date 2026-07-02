-- CreateEnum
-- A státusz natív PostgreSQL enum: az integritást nem csak az alkalmazás, hanem a DB motor is őrzi.
CREATE TYPE "PackageStatus" AS ENUM ('CREATED', 'RECEIVED_AT_CROSSDOCK', 'SORTED', 'DISPATCHED');

-- CreateTable
CREATE TABLE "packages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tracking_number" TEXT NOT NULL,
    "status" "PackageStatus" NOT NULL DEFAULT 'CREATED',
    "last_scan_location" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "packages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- UNIQUE constraint a tracking_number-en: duplikált címke / ikerkapu ellen a DB szintjén véd.
-- (Egyben index is -> a scan és a GET pont-lekérdezése index-alapú, nem full scan.)
CREATE UNIQUE INDEX "packages_tracking_number_key" ON "packages"("tracking_number");
