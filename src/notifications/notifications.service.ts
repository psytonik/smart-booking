import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  EMAIL_JOB,
  EmailJob,
  NOTIFICATIONS_QUEUE,
} from './notifications.constants.js';

/**
 * Queues outgoing notifications; a worker sends them with retries, so a
 * slow or failing email provider never blocks or fails the request.
 */
@Injectable()
export class NotificationsService {
  constructor(
    @InjectQueue(NOTIFICATIONS_QUEUE) private readonly queue: Queue<EmailJob>,
  ) {}

  async send(email: string, text: string, subject: string): Promise<void> {
    await this.queue.add(EMAIL_JOB, { to: email, subject, text });
  }
}
