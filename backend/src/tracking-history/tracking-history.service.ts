import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  TrackingHistory,
  TrackingHistoryDocument,
} from './schemas/tracking-history.schema';

/** Egy történeti bejegyzés a GET válaszban. */
export interface TrackingHistoryEntry {
  timestamp: Date;
  location: string;
  status: string;
}

@Injectable()
export class TrackingHistoryService {
  private readonly logger = new Logger(TrackingHistoryService.name);

  constructor(
    @InjectModel(TrackingHistory.name)
    private readonly historyModel: Model<TrackingHistoryDocument>,
  ) {}

  /**
   * ASZINKRON, fire-and-forget, SOHA NEM DOBÓ írás — a scan válaszát NEM buktatja el.
   *
   * A hívó (PackagesService.scan) NEM await-eli — a válasz nem várja be a Mongo-inzertet.
   * A read-after-write versenyt a hívónál a KETTŐS cache-invalidálás oldja: a promise
   * lezárultakor egy második DEL kitakarít minden, közben beragadt hiányos history-cache-t.
   * A metódus hibája graceful: a Promise mindig resolve-ol, a hibát logoljuk. A source of
   * truth a PostgreSQL, a történet "best effort" — éles rendszerben Transactional Outbox garantálná.
   */
  async recordEvent(
    event: TrackingHistoryEntry & { trackingNumber: string },
  ): Promise<void> {
    try {
      await this.historyModel.create({
        trackingNumber: event.trackingNumber,
        status: event.status,
        location: event.location,
        timestamp: event.timestamp,
      });
      this.logger.debug(
        `Tracking history recorded: ${event.trackingNumber} -> ${event.status} @ ${event.location}`,
      );
    } catch (err) {
      const error = err as Error;
      this.logger.error(
        `Failed to record tracking history for ${event.trackingNumber}: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Időrendi (növekvő) mozgástörténet egy csomaghoz. Az összetett index szolgálja ki.
   * `.lean()` — sík objektumot ad, nem teljes Mongoose dokumentumot (kevesebb overhead,
   * N+1 hidratálás elkerülése).
   */
  async findByTrackingNumber(
    trackingNumber: string,
  ): Promise<TrackingHistoryEntry[]> {
    const docs = await this.historyModel
      .find({ trackingNumber })
      .sort({ timestamp: 1 })
      .lean()
      .exec();

    return docs.map((doc) => ({
      timestamp: doc.timestamp,
      location: doc.location,
      status: doc.status,
    }));
  }
}
