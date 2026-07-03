import { PackageStatus } from '@prisma/client';

/**
 * A publikus válasz-szerződés (contract). A frontend és a jövőbeli integrátorok
 * erre a pontos alakra építenek; az E2E teszt eltörik, ha egy mező megváltozik.
 */
export interface PackageView {
  id: string;
  trackingNumber: string;
  status: PackageStatus;
  lastScanLocation: string | null;
  updatedAt: Date;
}

export interface TrackingHistoryView {
  timestamp: Date;
  location: string;
  status: string;
}

/** A GET /api/packages/:trackingNumber összevont válasza (SQL státusz + Mongo történet). */
export interface PackageWithHistoryView {
  package: PackageView;
  history: TrackingHistoryView[];
}
