import { Controller, Get } from '@nestjs/common';

/**
 * Egyszerű liveness végpont: GET /api/health.
 * A DevOps healthcheck (docker compose / orchestrator) erre pingelhet — nem érint DB-t,
 * így a folyamat életét jelzi, nem a függőségek állapotát (az külön readiness lenne).
 */
@Controller('health')
export class HealthController {
  @Get()
  check(): { status: string; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
