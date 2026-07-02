import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  TrackingHistory,
  TrackingHistorySchema,
} from './schemas/tracking-history.schema';
import { TrackingHistoryService } from './tracking-history.service';

/**
 * A MongoDB (Mongoose) réteg: a csomag append-only mozgástörténete.
 * A feature-modell regisztrálása -> injektálható a TrackingHistoryService-be.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TrackingHistory.name, schema: TrackingHistorySchema },
    ]),
  ],
  providers: [TrackingHistoryService],
  exports: [TrackingHistoryService],
})
export class TrackingHistoryModule {}
