import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import {
  NOTIFICATIONS_QUEUE,
  NOTIFY_LAST_MILE_COURIER,
  NotifyCourierPayload,
} from './notifications.constants';

/**
 * BullMQ PRODUCER.
 *
 * A scan végpont csak bedob egy jobot (~1 ms Redis-írás), és már válaszol is —
 * a futár API válaszideje/leállása NEM csatolódik a scan válaszidejéhez.
 *
 * A job `attempts` + exponenciális `backoff` konfigurációval fut:
 * átmeneti hibát (futár API 503) magától túlél. At-least-once kézbesítés ->
 * a fogyasztónak idempotensnek kell lennie.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectQueue(NOTIFICATIONS_QUEUE) private readonly queue: Queue,
    private readonly config: ConfigService,
  ) {}

  async enqueueCourierNotification(
    payload: NotifyCourierPayload,
  ): Promise<void> {
    const attempts = this.config.get<number>('notifications.attempts', 5);
    const backoffDelay = this.config.get<number>(
      'notifications.backoffDelayMs',
      1000,
    );

    try {
      await this.queue.add(NOTIFY_LAST_MILE_COURIER, payload, {
        attempts,
        backoff: { type: 'exponential', delay: backoffDelay },
        removeOnComplete: true,
        removeOnFail: 100,
      });
      this.logger.debug(
        `Enqueued ${NOTIFY_LAST_MILE_COURIER} for ${payload.trackingNumber} (status=${payload.status})`,
      );
    } catch (err) {
      // A job-beadás hibáját logoljuk (graceful): a scan source-of-truth írása már megtörtént.
      // Élesben itt a Transactional Outbox adna garanciát a kézbesítésre.
      this.logger.error(
        `Failed to enqueue courier notification for ${payload.trackingNumber}: ${(err as Error).message}`,
      );
    }
  }
}
