/**
 * A `bullmq` Worker osztályt inert stubbal helyettesítjük, hogy a @nestjs/bullmq
 * BullExplorer élő Redis-kapcsolat NÉLKÜL is regisztrálhassa a NotificationsProcessort
 * (a valódi Worker konstruktora kapcsolatot követel és azonnal csatlakozni próbálna).
 * A Queue és minden más `bullmq` export érintetlen marad — a producert a queue-mock fedi le.
 * Ez teszi a teljes E2E-t determinisztikussá és offline futtathatóvá.
 */
jest.mock('bullmq', () => {
  const actual = jest.requireActual('bullmq');
  class WorkerStub {
    on(): this {
      return this;
    }
    async close(): Promise<void> {
      return undefined;
    }
    async run(): Promise<void> {
      return undefined;
    }
  }
  return { ...actual, Worker: WorkerStub };
});

import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { getQueueToken } from '@nestjs/bullmq';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { REDIS_CLIENT } from '../src/redis/redis.constants';
import { CacheService } from '../src/redis/cache.service';
import { TrackingHistory } from '../src/tracking-history/schemas/tracking-history.schema';
import { NOTIFICATIONS_QUEUE, NOTIFY_LAST_MILE_COURIER } from '../src/notifications/notifications.constants';
import { AllExceptionsFilter } from '../src/common/http-exception.filter';

/**
 * E2E teszt a POST /api/packages/scan végpontra — a teljes HTTP-rétegen keresztül,
 * ÉLŐ ADATBÁZIS NÉLKÜL. A PrismaService, a Mongoose modell, a Redis kliens és a
 * BullMQ queue mind overrideProvider-rel mockolva:
 * determinizmus, sebesség, éles hibahatár-tesztelés (DISPATCHED állapot szimulálása).
 *
 * Amit assertálunk:
 *  - sikeres scan: státuszléptetés (CREATED -> RECEIVED_AT_CROSSDOCK), queue-hívás, cache DEL
 *  - üres body -> 400 (DTO-validáció a ValidationPipe-nál)
 *  - DISPATCHED újraszkennelése -> 409 (state machine a tranzakción belül)
 */

interface FakePackage {
  id: string;
  trackingNumber: string;
  status: string;
  lastScanLocation: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * In-memory Prisma mock. A $transaction egy interaktív tranzakciót szimulál:
 * a callbacknek átadott `tx` ugyanaz a delegate-halmaz, mint a kliens — így a
 * service olvasás->validálás->írás logikája valósághűen fut, csak memóriában.
 */
class PrismaMock {
  store = new Map<string, FakePackage>();
  private seq = 0;

  package = {
    findUnique: jest.fn(
      async (args: { where: { trackingNumber?: string; id?: string } }) => {
        if (args.where.trackingNumber !== undefined) {
          return this.store.get(args.where.trackingNumber) ?? null;
        }
        if (args.where.id !== undefined) {
          for (const p of this.store.values()) {
            if (p.id === args.where.id) return p;
          }
        }
        return null;
      },
    ),
    create: jest.fn(async (args: { data: Partial<FakePackage> }) => {
      const now = new Date();
      const pkg: FakePackage = {
        id: `pkg-${++this.seq}`,
        trackingNumber: args.data.trackingNumber as string,
        status: args.data.status as string,
        lastScanLocation: (args.data.lastScanLocation as string) ?? null,
        createdAt: now,
        updatedAt: now,
      };
      this.store.set(pkg.trackingNumber, pkg);
      return pkg;
    }),
    update: jest.fn(
      async (args: { where: { id: string }; data: Partial<FakePackage> }) => {
        let target: FakePackage | undefined;
        for (const p of this.store.values()) {
          if (p.id === args.where.id) {
            target = p;
            break;
          }
        }
        if (target === undefined) {
          throw new Error('Record to update not found');
        }
        if (args.data.status !== undefined) target.status = args.data.status;
        if (args.data.lastScanLocation !== undefined)
          target.lastScanLocation = args.data.lastScanLocation ?? null;
        target.updatedAt = new Date();
        return target;
      },
    ),
  };

  // Interaktív tranzakció: a callbackot azonnal, ugyanezen a példányon futtatja.
  $transaction = jest.fn(
    async <T>(fn: (tx: PrismaMock) => Promise<T>): Promise<T> => fn(this),
  );

  // Életciklus no-op-ok (a service nem hívja, de a típusegyezéshez itt vannak).
  $connect = jest.fn(async () => undefined);
  $disconnect = jest.fn(async () => undefined);

  /** Teszt-segéd: közvetlen állapotbeállítás (pl. DISPATCHED előkészítése). */
  seed(pkg: FakePackage): void {
    this.store.set(pkg.trackingNumber, pkg);
  }
}

/** Mongoose model mock — csak a service által hívott create/find lánc. */
const trackingHistoryModelMock = {
  create: jest.fn(async () => ({})),
  find: jest.fn(() => ({
    sort: () => ({
      lean: () => ({
        exec: async () => [],
      }),
    }),
  })),
};

/** Redis kliens mock (ioredis felület, amit a CacheService használ). */
const redisMock = {
  get: jest.fn(async () => null),
  set: jest.fn(async () => 'OK'),
  del: jest.fn(async () => 1),
};

/** BullMQ queue mock. A `add` szignatúráját explicit tipizáljuk, hogy a
 *  mock.calls elemei helyesen [name, payload, opts] hármasként olvashatók legyenek. */
const queueMock = {
  add: jest.fn(
    async (
      _name: string,
      _payload: Record<string, unknown>,
      _opts: Record<string, unknown>,
    ) => ({ id: 'job-1' }),
  ),
};

/** A Mongoose connection mock — a MongooseModule.forRootAsync helyett, hogy ne nyisson kapcsolatot. */
const mongoConnectionMock = {
  readyState: 1,
  close: jest.fn(async () => undefined),
  on: jest.fn(),
  once: jest.fn(),
  model: jest.fn(),
};

describe('POST /api/packages/scan (e2e, fully mocked)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = new PrismaMock();
    jest.clearAllMocks();

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(getModelToken(TrackingHistory.name))
      .useValue(trackingHistoryModelMock)
      .overrideProvider(getConnectionToken())
      .useValue(mongoConnectionMock)
      .overrideProvider(REDIS_CLIENT)
      .useValue(redisMock)
      .overrideProvider(getQueueToken(NOTIFICATIONS_QUEUE))
      .useValue(queueMock)
      .compile();

    app = moduleRef.createNestApplication();
    // A production bootstrap globális beállításait tükrözzük, hogy a szerződést teszteljük.
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('sikeres scan: új csomagot CREATED-ből RECEIVED_AT_CROSSDOCK-ra léptet, queue-t hív és cache-t invalidál', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/packages/scan')
      .send({ trackingNumber: 'TRK-1001', location: 'GATE-A' })
      .expect(HttpStatus.OK);

    // Válasz-szerződés
    expect(res.body).toMatchObject({
      trackingNumber: 'TRK-1001',
      status: 'RECEIVED_AT_CROSSDOCK',
      lastScanLocation: 'GATE-A',
    });
    expect(res.body.id).toEqual(expect.any(String));
    expect(res.body.updatedAt).toEqual(expect.any(String));

    // Státuszléptetés tranzakcióban történt
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.package.create).toHaveBeenCalledTimes(1);

    // Cache-invalidálás: DEL tracking:{trackingNumber}. A viselkedés KETTŐS invalidálás:
    // (1) azonnali DEL a commit után, (2) egy második DEL a fire-and-forget history-írás
    // lezárultakor. A válasz idejére legalább az első DEL biztosan lefutott.
    const trackingKey = CacheService.trackingKey('TRK-1001');
    expect(redisMock.del).toHaveBeenCalledWith(trackingKey);

    // A history-írás fire-and-forget: a függő microtaskokat (recordEvent + .finally-ben a
    // második DEL) leürítjük, hogy a kettős invalidálás második ága is megfigyelhető legyen.
    await new Promise((resolve) => setImmediate(resolve));

    // A történet-írás elindult (aszinkron, de a scan nem várta be a válasz előtt).
    expect(trackingHistoryModelMock.create).toHaveBeenCalledTimes(1);
    // A kettős invalidálás után a DEL legalább kétszer futott ugyanarra a kulcsra.
    expect(redisMock.del).toHaveBeenCalledTimes(2);
    expect(redisMock.del).toHaveBeenNthCalledWith(2, trackingKey);

    // Pontosan egy NOTIFY_LAST_MILE_COURIER job, helyes payloaddal + retry konfiggal
    expect(queueMock.add).toHaveBeenCalledTimes(1);
    const [jobName, payload, opts] = queueMock.add.mock.calls[0];
    expect(jobName).toBe(NOTIFY_LAST_MILE_COURIER);
    expect(payload).toEqual({
      trackingNumber: 'TRK-1001',
      status: 'RECEIVED_AT_CROSSDOCK',
      location: 'GATE-A',
    });
    expect(opts).toMatchObject({
      attempts: expect.any(Number),
      backoff: { type: 'exponential', delay: expect.any(Number) },
    });
  });

  it('üres body -> 400 Bad Request (DTO-validáció)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/packages/scan')
      .send({})
      .expect(HttpStatus.BAD_REQUEST);

    expect(res.body.statusCode).toBe(HttpStatus.BAD_REQUEST);
    // A rossz input nem jutott adatbázisig, és nem ment ki értesítés.
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(queueMock.add).not.toHaveBeenCalled();
    expect(redisMock.del).not.toHaveBeenCalled();
  });

  it('üres trackingNumber string -> 400 Bad Request', async () => {
    await request(app.getHttpServer())
      .post('/api/packages/scan')
      .send({ trackingNumber: '   ', location: 'GATE-A' })
      .expect(HttpStatus.BAD_REQUEST);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('DISPATCHED csomag újraszkennelése -> 409 Conflict (state machine + rollback)', async () => {
    const now = new Date();
    prisma.seed({
      id: 'pkg-existing',
      trackingNumber: 'TRK-DONE',
      status: 'DISPATCHED',
      lastScanLocation: 'GATE-Z',
      createdAt: now,
      updatedAt: now,
    });

    const res = await request(app.getHttpServer())
      .post('/api/packages/scan')
      .send({ trackingNumber: 'TRK-DONE', location: 'GATE-A' })
      .expect(HttpStatus.CONFLICT);

    expect(res.body.statusCode).toBe(HttpStatus.CONFLICT);

    // Tranzakció lefutott (olvasott + validált), de NEM írt (rollback szemantika)
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.package.update).not.toHaveBeenCalled();
    expect(prisma.package.create).not.toHaveBeenCalled();

    // A hibás átmenet után NINCS mellékhatás: se queue, se cache-invalidálás
    expect(queueMock.add).not.toHaveBeenCalled();
    expect(redisMock.del).not.toHaveBeenCalled();
  });
});
