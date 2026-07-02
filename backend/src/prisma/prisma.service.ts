import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * A PrismaClient életciklusát a Nest DI-hoz köti.
 * A kapcsolatot a modul indulásakor nyitjuk, leállásakor tisztán zárjuk
 * (nincs szivárgó connection pool).
 *
 * Bővíti a PrismaClient-et -> a $transaction, a modell-delegátok (package)
 * és a típusok közvetlenül elérhetők. Így a service könnyen mockolható:
 * a teszt egy sima objektummal helyettesíti (overrideProvider).
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Prisma connected to PostgreSQL');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Prisma disconnected from PostgreSQL');
  }
}
