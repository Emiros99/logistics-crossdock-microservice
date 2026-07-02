import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type TrackingHistoryDocument = HydratedDocument<TrackingHistory>;

/**
 * A csomag TELJES mozgástörténete — append-only eseménynapló.
 * Nagyra növő kollekció: napi 100k csomag × 5-10 esemény. Ezért:
 *  - trackingNumber INDEXELT (időrendi olvasás pont-lekérdezéssel, nem full collection scan),
 *  - séma rugalmas: később GPS/hőmérséklet/foto migráció nélkül bővíthető.
 */
@Schema({ collection: 'tracking_history', versionKey: false })
export class TrackingHistory {
  @Prop({ required: true, index: true })
  trackingNumber!: string;

  @Prop({ required: true })
  status!: string;

  @Prop({ required: true })
  location!: string;

  @Prop({ required: true, default: () => new Date() })
  timestamp!: Date;
}

export const TrackingHistorySchema =
  SchemaFactory.createForClass(TrackingHistory);

// Összetett index az időrendi lekérdezéshez (trackingNumber szerint, időben rendezve).
TrackingHistorySchema.index({ trackingNumber: 1, timestamp: 1 });
