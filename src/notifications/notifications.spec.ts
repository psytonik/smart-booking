import { NotificationsService } from './notifications.service';
import { NotificationsProcessor } from './notifications.processor';
import { EMAIL_JOB } from './notifications.constants';

describe('Notifications', () => {
  it('queues an email job instead of sending inline', async () => {
    const queue = { add: jest.fn() };
    const service = new NotificationsService(queue as any);

    await service.send('a@b.c', 'Body', 'Subject');

    expect(queue.add).toHaveBeenCalledWith(EMAIL_JOB, {
      to: 'a@b.c',
      subject: 'Subject',
      text: 'Body',
    });
  });

  describe('NotificationsProcessor', () => {
    const job = (overrides = {}) =>
      ({
        name: EMAIL_JOB,
        data: { to: 'a@b.c', subject: 'S', text: 'T' },
        attemptsMade: 0,
        opts: { attempts: 6 },
        ...overrides,
      }) as any;

    it('sends the email', async () => {
      const sender = { send: jest.fn() };
      await new NotificationsProcessor(sender as any).process(job());
      expect(sender.send).toHaveBeenCalledWith(job().data);
    });

    it('rethrows a send failure so the queue retries it', async () => {
      const sender = { send: jest.fn().mockRejectedValue(new Error('smtp')) };
      const processor = new NotificationsProcessor(sender as any);
      jest.spyOn((processor as any).logger, 'error').mockImplementation();

      await expect(processor.process(job())).rejects.toThrow('smtp');
    });
  });
});
