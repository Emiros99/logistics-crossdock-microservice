/**
 * Központi, típusolt konfiguráció. Egyetlen forrás az env változókhoz,
 * így a modulok nem szórják szét a `process.env` hivatkozásokat (Clean Code / DRY).
 */
export interface AppConfig {
  port: number;
  corsOrigin: string;
  databaseUrl: string;
  mongoUri: string;
  redis: {
    host: string;
    port: number;
  };
  cache: {
    /** tracking:{trackingNumber} kulcs TTL-je másodpercben (rövid, biztonsági háló). */
    trackingTtlSeconds: number;
  };
  notifications: {
    attempts: number;
    backoffDelayMs: number;
  };
}

export default (): AppConfig => ({
  port: parseInt(process.env.PORT ?? '3001', 10),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  databaseUrl:
    process.env.DATABASE_URL ??
    'postgresql://postgres:postgres@localhost:5432/crossdock',
  mongoUri: process.env.MONGO_URI ?? 'mongodb://localhost:27017/crossdock_tracking',
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  },
  cache: {
    trackingTtlSeconds: parseInt(process.env.CACHE_TRACKING_TTL ?? '30', 10),
  },
  notifications: {
    // A sor- és jobnév NEM env-konfig: a notifications.constants.ts az
    // egyetlen igazságforrás (a producer és a processor is onnan importál).
    attempts: parseInt(process.env.NOTIFY_ATTEMPTS ?? '5', 10),
    backoffDelayMs: parseInt(process.env.NOTIFY_BACKOFF_MS ?? '1000', 10),
  },
});
