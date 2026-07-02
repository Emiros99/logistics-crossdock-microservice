import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Global modul: a PrismaService egy példányban, DI-n keresztül bárhol elérhető,
 * anélkül hogy minden feature-modul újra importálná.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
