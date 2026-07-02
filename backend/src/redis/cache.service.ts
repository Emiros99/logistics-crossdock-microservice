import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

/**
 * Cache-aside olvasási réteg.
 *
 * Tervezési elv: a cache SOSEM buktatja el a kérést. Minden Redis-hiba
 * "graceful degradation" -> a hívó úgy folytatja, mintha cache-miss lenne
 * (DB-re megy). Így a Redis kiesése lassulás, nem hiba.
 *
 * Kulcskonvenció: `tracking:{trackingNumber}`.
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  /** A tracking-cache kulcsának egyetlen forrása (DRY, elgépelés-védelem). */
  static trackingKey(trackingNumber: string): string {
    return `tracking:${trackingNumber}`;
  }

  /**
   * Típusos olvasás JSON-deszerializálással. Hiba/miss esetén null -> DB fallback.
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.redis.get(key);
      if (raw === null) {
        return null;
      }
      return JSON.parse(raw) as T;
    } catch (err) {
      this.logger.warn(
        `Cache GET failed (key=${key}): ${(err as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Írás rövid TTL-lel. A TTL a biztonsági háló: ha az invalidálás kimaradna,
   * a bejegyzés magától lejár (az elavultság felülről korlátos).
   */
  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (err) {
      this.logger.warn(
        `Cache SET failed (key=${key}): ${(err as Error).message}`,
      );
    }
  }

  /**
   * Invalidálás írásnál (delete-on-write): versenyhelyzetben biztonságosabb,
   * mint az update-on-write. A következő olvasás tölti újra a DB-ből.
   */
  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (err) {
      this.logger.warn(
        `Cache DEL failed (key=${key}): ${(err as Error).message}`,
      );
    }
  }
}
