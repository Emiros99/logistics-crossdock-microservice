import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';
import { CacheService } from './cache.service';

/**
 * A nyers ioredis klienst factory-ként hozzuk létre, hogy a konfigurációt
 * a ConfigService-ből kapja, és külön (mockolható) tokenen keresztül injektálható legyen.
 *
 * A graceful degradation elve szerint a Redis kiesése teljesítmény-, nem adatvesztés-esemény:
 * a kliens hibáit logoljuk, de nem dobjuk — a CacheService minden műveletet védetten hív.
 *
 * A `provide`/factory által létrehozott ioredis kliens rendelkezik `quit()`-tel;
 * a Nest a shutdown hookokat a provider példányán nem hívja automatikusan, ezért
 * a graceful zárást a folyamat leállása kezeli (PoC-szint).
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Redis => {
        const logger = new Logger('RedisClient');
        const host = config.get<string>('redis.host', 'localhost');
        const port = config.get<number>('redis.port', 6379);

        const client = new Redis({
          host,
          port,
          lazyConnect: true,
          maxRetriesPerRequest: 2,
          enableOfflineQueue: false,
        });

        client.on('error', (err: Error) => {
          logger.warn(`Redis error: ${err.message}`);
        });
        client.on('connect', () => logger.log(`Redis connected ${host}:${port}`));

        void client.connect().catch((err: Error) => {
          logger.warn(`Redis initial connect failed: ${err.message}`);
        });

        return client;
      },
    },
    CacheService,
  ],
  exports: [REDIS_CLIENT, CacheService],
})
export class RedisModule {}
