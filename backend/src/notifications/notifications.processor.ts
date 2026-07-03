import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  NOTIFICATIONS_QUEUE,
  NOTIFY_LAST_MILE_COURIER,
  NotifyCourierPayload,
} from './notifications.constants';

/**
 * BullMQ PROCESSOR (worker) — a `notifications` sor jobjait dolgozza fel,
 * saját ütemében, a scan kéréstől időben szétcsatolva.
 *
 * PoC-ban a "feldolgozás" = strukturált logolás. Éles rendszerben itt menne ki
 * a valódi HTTP-hívás a last-mile futár API-ja felé (idempotensen, mert at-least-once).
 * A dobott hiba -> a BullMQ újrapróbál (attempts + exponenciális backoff).
 */
@Processor(NOTIFICATIONS_QUEUE)
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  async process(job: Job<NotifyCourierPayload>): Promise<void> {
    switch (job.name) {
      case NOTIFY_LAST_MILE_COURIER: {
        const { trackingNumber, status, location } = job.data;
        this.logger.log(
          `[${NOTIFY_LAST_MILE_COURIER}] attempt ${job.attemptsMade + 1}: ` +
            `notifying last-mile courier for ${trackingNumber} ` +
            `(status=${status}, location=${location})`,
        );
        // Itt hívnánk a valódi futár API-t. PoC: sikeres feldolgozásnak tekintjük.
        return;
      }
      default: {
        this.logger.warn(`Unknown job received on notifications queue: ${job.name}`);
        return;
      }
    }
  }
}
