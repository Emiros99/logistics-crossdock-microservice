import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Package, PackageStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../redis/cache.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TrackingHistoryService } from '../tracking-history/tracking-history.service';
import { ScanPackageDto } from './dto/scan-package.dto';
import {
  PackageView,
  PackageWithHistoryView,
} from './dto/package-response.dto';
import { PackageStatusMachine } from './package-status.machine';

/**
 * A cross-docking domain magja.
 *
 * A scan kritikus útja: Prisma interaktív tranzakció (szinkron, ACID), majd a Mongo
 * történet-írás ASZINKRON, fire-and-forget indítása (a scan válasza NEM várja be —
 * a source of truth a PostgreSQL, a történet "best effort").
 * A cache-invalidálás KETTŐS (lásd a scan metódust): egy azonnali DEL a commit után,
 * és egy második DEL a history-írás lezárultakor. Így egy közben becsúszó GET által
 * beragasztott, még hiányos history-t a második DEL kitakarít (30 mp helyett azonnal).
 * A mellékhatások hibája graceful (nem buktatja a scant):
 *   - Mongo történet: NEM await-elt, de soha nem dob (a TrackingHistoryService elnyeli és logolja),
 *   - cache DEL + queue add: gyors Redis-műveletek, hibájuk graceful.
 */
@Injectable()
export class PackagesService {
  private readonly logger = new Logger(PackagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly history: TrackingHistoryService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Szkennelés: ha a trackingNumber nem létezik, létrehozás CREATED-ben, majd léptetés.
   * Ha létezik, egy lépés előre a state machine szerint. DISPATCHED újraszkennelése -> 409.
   *
   * Az egész "olvasás -> validálás -> írás/létrehozás" egyetlen INTERAKTÍV tranzakcióban fut,
   * így atomi és a Postgres sorszintű zárolása szerializálja a konkurens (ikerkapus) scaneket.
   */
  async scan(dto: ScanPackageDto): Promise<PackageView> {
    const updated = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient): Promise<Package> => {
        const existing = await tx.package.findUnique({
          where: { trackingNumber: dto.trackingNumber },
        });

        // Új csomag: létrehozás CREATED-ben, majd az első léptetés RECEIVED_AT_CROSSDOCK-ra.
        if (existing === null) {
          const firstStatus = PackageStatusMachine.next(PackageStatus.CREATED);
          // Az elágazás elméletileg mindig ad értéket; a típusbiztonság kedvéért kezeljük.
          if (firstStatus === null) {
            throw new ConflictException('Invalid initial state transition');
          }
          return tx.package.create({
            data: {
              trackingNumber: dto.trackingNumber,
              status: firstStatus,
              lastScanLocation: dto.location,
            },
          });
        }

        // Létező csomag: state machine validálás a tranzakción belül.
        const nextStatus = PackageStatusMachine.next(existing.status);
        if (nextStatus === null) {
          // DISPATCHED (végállapot) újraszkennelése -> 409 Conflict + ROLLBACK.
          throw new ConflictException(
            `Package ${dto.trackingNumber} is already in terminal state ${existing.status} and cannot be scanned again`,
          );
        }

        return tx.package.update({
          where: { id: existing.id },
          data: {
            status: nextStatus,
            lastScanLocation: dto.location,
          },
        });
      },
    );

    // --- A tranzakción KÍVÜLI mellékhatások ---
    const view = this.toView(updated);
    const cacheKey = CacheService.trackingKey(view.trackingNumber);

    // (2) ELSŐ (azonnali) cache-invalidálás a commit után: delete-on-write.
    //     A frissen léptetett csomagot azonnal láthatóvá tesszük a következő olvasásnak.
    //     Graceful (a CacheService nem dob).
    await this.cache.del(cacheKey);

    // (3) Történet: ASZINKRON, fire-and-forget Mongo-írás — a scan válasza NEM várja be.
    //     A recordEvent graceful (logol, sosem dob). A promise lezárultakor egy MÁSODIK
    //     DEL fut ugyanarra a kulcsra: ha az (1) DEL és a history commit-ja közé becsúszó
    //     GET beragasztott egy még hiányos history-t a cache-be, ezt a második DEL kitakarítja
    //     — így a következő olvasás már a teljes történettel tölti újra (nincs 30 mp-es beragadás).
    void this.history
      .recordEvent({
        trackingNumber: view.trackingNumber,
        status: view.status,
        location: view.lastScanLocation ?? dto.location,
        timestamp: view.updatedAt,
      })
      .finally(() => {
        void this.cache.del(cacheKey);
      });

    // (4) Aszinkron futár-értesítés a BullMQ sorba (graceful; nem buktatja a scant).
    await this.notifications.enqueueCourierNotification({
      trackingNumber: view.trackingNumber,
      status: view.status,
      location: view.lastScanLocation ?? dto.location,
    });

    this.logger.log(
      `Scanned ${view.trackingNumber}: ${view.status} @ ${view.lastScanLocation}`,
    );
    return view;
  }

  /**
   * Tracking lekérdezés cache-aside mintával (Redis -> miss esetén SQL + Mongo aggregáció).
   * 404, ha a csomag nem létezik (a source of truth PostgreSQL alapján).
   */
  async findByTrackingNumber(
    trackingNumber: string,
  ): Promise<PackageWithHistoryView> {
    const key = CacheService.trackingKey(trackingNumber);

    const cached = await this.cache.get<PackageWithHistoryView>(key);
    if (cached !== null) {
      this.logger.debug(`Cache HIT ${key}`);
      return this.reviveDates(cached);
    }

    const pkg = await this.prisma.package.findUnique({
      where: { trackingNumber },
    });
    if (pkg === null) {
      throw new NotFoundException(
        `Package with tracking number ${trackingNumber} not found`,
      );
    }

    const history = await this.history.findByTrackingNumber(trackingNumber);

    const result: PackageWithHistoryView = {
      package: this.toView(pkg),
      history,
    };

    const ttl = this.config.get<number>('cache.trackingTtlSeconds', 30);
    await this.cache.set(key, result, ttl);

    return result;
  }

  /** Prisma entitás -> publikus válasz-nézet (a belső mezőket nem szivárogtatjuk ki). */
  private toView(pkg: Package): PackageView {
    return {
      id: pkg.id,
      trackingNumber: pkg.trackingNumber,
      status: pkg.status,
      lastScanLocation: pkg.lastScanLocation,
      updatedAt: pkg.updatedAt,
    };
  }

  /**
   * JSON.parse után a dátumok stringgé válnak; a szerződés Date-et ígér.
   * A cache-ből visszaolvasott értéken helyreállítjuk a Date típusokat.
   */
  private reviveDates(
    value: PackageWithHistoryView,
  ): PackageWithHistoryView {
    return {
      package: {
        ...value.package,
        updatedAt: new Date(value.package.updatedAt),
      },
      history: value.history.map((h) => ({
        ...h,
        timestamp: new Date(h.timestamp),
      })),
    };
  }
}
