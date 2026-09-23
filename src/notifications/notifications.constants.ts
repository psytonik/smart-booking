export const NOTIFICATIONS_QUEUE = 'notifications';
export const EMAIL_JOB = 'email';

export interface EmailJob {
  to: string;
  subject: string;
  text: string;
}
