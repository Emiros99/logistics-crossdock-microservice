import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { TrackingHistoryModule } from '../tracking-history/tracking-history.module';
import { PackagesController } from './packages.controller';
import { PackagesService } from './packages.service';

/**
 * A domain feature-modul. A PrismaModule és a RedisModule globális (nem kell importálni);
 * a Mongo és a BullMQ producer explicit függőség -> a modulhatárok láthatók.
 */
@Module({
  imports: [TrackingHistoryModule, NotificationsModule],
  controllers: [PackagesController],
  providers: [PackagesService],
})
export class PackagesModule {}
