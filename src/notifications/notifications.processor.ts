import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EmailSender } from './email.sender.js';
import {
  EMAIL_JOB,
  EmailJob,
  NOTIFICATIONS_QUEUE,
} from './notifications.constants.js';

@Processor(NOTIFICATIONS_QUEUE)
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(private readonly emailSender: EmailSender) {
    super();
  }

  async process(job: Job<EmailJob>): Promise<void> {
    if (job.name !== EMAIL_JOB) {
      this.logger.warn(`Ignoring unknown job "${job.name}"`);
      return;
    }
    try {
      await this.emailSender.send(job.data);
    } catch (e) {
      // Rethrow so BullMQ retries with backoff; log each failed attempt.
      this.logger.error(
        `Email to ${job.data.to} failed (attempt ${job.attemptsMade + 1}/${job.opts.attempts})`,
        e,
      );
      throw e;
    }
  }
}
