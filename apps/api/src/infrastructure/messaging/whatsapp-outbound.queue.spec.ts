import { UnrecoverableError } from 'bullmq';
import { MetaApiError } from './meta-whatsapp.client';
import { OutboundJobData, WhatsAppOutboundQueue } from './whatsapp-outbound.queue';

jest.mock('bullmq', () => {
  class UnrecoverableError extends Error {}
  return {
    Queue: jest.fn().mockImplementation(() => ({ add: jest.fn(), close: jest.fn() })),
    Worker: jest.fn(),
    UnrecoverableError,
  };
});

describe('WhatsAppOutboundQueue', () => {
  const job: OutboundJobData = {
    messageId: 'msg-1',
    tenantId: 'tenant-1',
    to: '573001112233',
    content: 'Tu moto está lista',
  };

  let metaClient: { sendText: jest.Mock; sendTemplate: jest.Mock };
  let repo: { updateMessageStatus: jest.Mock };
  let notification: { notifyAdmins: jest.Mock };
  let queue: WhatsAppOutboundQueue;

  beforeEach(() => {
    metaClient = {
      sendText: jest.fn().mockResolvedValue({ waMessageId: 'wamid.1' }),
      sendTemplate: jest.fn().mockResolvedValue({ waMessageId: 'wamid.2' }),
    };
    repo = { updateMessageStatus: jest.fn().mockResolvedValue(undefined) };
    notification = { notifyAdmins: jest.fn().mockResolvedValue(undefined) };
    queue = new WhatsAppOutboundQueue(metaClient as never, repo as never, notification as never);
  });

  describe('processJob', () => {
    it('sends free text and marks the message SENT', async () => {
      await queue.processJob(job);
      expect(metaClient.sendText).toHaveBeenCalledWith(job.to, job.content);
      expect(metaClient.sendTemplate).not.toHaveBeenCalled();
      expect(repo.updateMessageStatus).toHaveBeenCalledWith('msg-1', 'SENT', 'wamid.1');
    });

    it('sends the template when the job carries one (closed 24h window)', async () => {
      await queue.processJob({
        ...job,
        template: { name: 'notificacion_taller', params: ['Tu moto está lista'] },
      });
      expect(metaClient.sendTemplate).toHaveBeenCalledWith(job.to, 'notificacion_taller', [
        'Tu moto está lista',
      ]);
      expect(metaClient.sendText).not.toHaveBeenCalled();
      expect(repo.updateMessageStatus).toHaveBeenCalledWith('msg-1', 'SENT', 'wamid.2');
    });

    it('rethrows permanent Meta errors as UnrecoverableError to stop retries', async () => {
      metaClient.sendText.mockRejectedValue(new MetaApiError(400, 131047, 'window closed'));
      const promise = queue.processJob(job);
      await expect(promise).rejects.toBeInstanceOf(UnrecoverableError);
      await promise.catch((e: Error & { metaCode?: number }) => {
        expect(e.metaCode).toBe(131047); // carried for the failure notification
      });
    });

    it('rethrows transient errors as-is so BullMQ retries them', async () => {
      const transient = new MetaApiError(503, null, 'unavailable');
      metaClient.sendText.mockRejectedValue(transient);
      await expect(queue.processJob(job)).rejects.toBe(transient);
    });
  });

  describe('handleFinalFailure', () => {
    const envBackup = {
      id: process.env['WHATSAPP_PHONE_NUMBER_ID'],
      token: process.env['WHATSAPP_ACCESS_TOKEN'],
    };

    beforeEach(() => {
      process.env['WHATSAPP_PHONE_NUMBER_ID'] = '12345';
      process.env['WHATSAPP_ACCESS_TOKEN'] = 'token';
    });

    afterAll(() => {
      if (envBackup.id === undefined) delete process.env['WHATSAPP_PHONE_NUMBER_ID'];
      else process.env['WHATSAPP_PHONE_NUMBER_ID'] = envBackup.id;
      if (envBackup.token === undefined) delete process.env['WHATSAPP_ACCESS_TOKEN'];
      else process.env['WHATSAPP_ACCESS_TOKEN'] = envBackup.token;
    });

    it('marks the message FAILED and notifies the tenant admins', async () => {
      const error = Object.assign(new Error('window closed'), { metaCode: 131047 });
      await queue.handleFinalFailure(job, error);
      expect(repo.updateMessageStatus).toHaveBeenCalledWith('msg-1', 'FAILED');
      expect(notification.notifyAdmins).toHaveBeenCalledWith('tenant-1', {
        type: 'WHATSAPP_SEND_FAILED',
        phone: job.to,
        messageId: 'msg-1',
        metaCode: 131047,
      });
    });

    it('skips the admin alert for stale jobs without tenantId (pre-deploy queue)', async () => {
      await queue.handleFinalFailure({ ...job, tenantId: undefined as never });
      expect(repo.updateMessageStatus).toHaveBeenCalledWith('msg-1', 'FAILED');
      expect(notification.notifyAdmins).not.toHaveBeenCalled();
    });

    it('skips the admin alert when the WhatsApp channel is not provisioned', async () => {
      delete process.env['WHATSAPP_PHONE_NUMBER_ID'];
      await queue.handleFinalFailure(job);
      expect(repo.updateMessageStatus).toHaveBeenCalledWith('msg-1', 'FAILED');
      expect(notification.notifyAdmins).not.toHaveBeenCalled();
    });

    it('never throws, even when persistence or notification fail', async () => {
      repo.updateMessageStatus.mockRejectedValue(new Error('db down'));
      await expect(queue.handleFinalFailure(job)).resolves.toBeUndefined();
    });
  });
});
