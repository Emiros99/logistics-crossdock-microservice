import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/http-exception.filter';

/**
 * Bootstrap. A globális beállítások (prefix, CORS, validáció, hibaformátum)
 * egy helyen — a KÖZÖS KONTRAKTUM szerint: port 3001, prefix /api, CORS a :3000 felé.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  app.setGlobalPrefix('api');

  app.enableCors({
    origin: config.get<string>('corsOrigin', 'http://localhost:3000'),
    methods: ['GET', 'POST'],
    credentials: true,
  });

  // Globális, szigorú validáció: a DTO-kon kívüli mezők lehullanak (whitelist),
  // tiltott extra mező -> 400; a payload a DTO-típusra transzformálódik.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  // Graceful shutdown -> onModuleDestroy (Prisma $disconnect) lefut.
  app.enableShutdownHooks();

  const port = config.get<number>('port', 3001);
  await app.listen(port);
  logger.log(`Cross-Docking API listening on http://localhost:${port}/api`);
}

void bootstrap();
