import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import configuration from './config/configuration';
import { HealthController } from './health/health.controller';
import { NotificationsModule } from './notifications/notifications.module';
import { PackagesModule } from './packages/packages.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { TrackingHistoryModule } from './tracking-history/tracking-history.module';

/**
 * A kompozíciós gyökér. Minden globális infrastruktúrát async módon,
 * a típusolt konfigurációból (ConfigService) huzaloz be -> nincs szórt process.env.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),

    // Globális rate limiting (SQL injection/DoS elleni alap-védvonal része).
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 1000, limit: 100 },
    ]),

    // MongoDB (Mongoose) — append-only mozgástörténet.
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('mongoUri'),
      }),
    }),

    // BullMQ globális kapcsolat (Redis-backed) — a sorokat a feature-modulok regisztrálják.
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('redis.host'),
          port: config.get<number>('redis.port'),
        },
      }),
    }),

    PrismaModule,
    RedisModule,
    TrackingHistoryModule,
    NotificationsModule,
    PackagesModule,
  ],
  controllers: [HealthController],
  providers: [
    // Globális throttler guard.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
