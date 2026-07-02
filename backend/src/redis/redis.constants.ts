/**
 * DI token az ioredis kliensre. Külön token -> a service nem az implementációtól,
 * hanem egy absztrakt tokentől függ (DIP), és a teszt könnyen felülírja
 * (overrideProvider(REDIS_CLIENT)).
 */
export const REDIS_CLIENT = 'REDIS_CLIENT';
