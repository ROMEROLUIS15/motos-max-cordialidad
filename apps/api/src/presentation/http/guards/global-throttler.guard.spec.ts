import { Request } from 'express';
import { GlobalThrottlerGuard } from './global-throttler.guard';

/** Exposes the protected tracker without standing up the whole guard. */
class TestableGuard extends GlobalThrottlerGuard {
  track(req: Partial<Request>): Promise<string> {
    return this.getTracker(req as Request);
  }
}

const guard = Object.create(TestableGuard.prototype) as TestableGuard;

const bearerFor = (sub: string): string => {
  const payload = Buffer.from(JSON.stringify({ sub, tenantId: 't1' })).toString('base64url');
  return `Bearer header.${payload}.signature`;
};

describe('GlobalThrottlerGuard tracker', () => {
  it('keys authenticated callers by user, so a shared IP is not a shared quota', async () => {
    const ana = await guard.track({
      ip: '190.0.0.1',
      path: '/api/notifications/unread-count',
      headers: { authorization: bearerFor('user-ana') },
    });
    const luis = await guard.track({
      ip: '190.0.0.1', // same workshop, same router
      path: '/api/notifications/unread-count',
      headers: { authorization: bearerFor('user-luis') },
    });

    expect(ana).not.toBe(luis);
    expect(ana).toContain('user-ana');
  });

  it('keys anonymous callers by IP, which is the only identity they have', async () => {
    const tracker = await guard.track({
      ip: '190.0.0.1',
      path: '/api/auth/login',
      headers: {},
    });
    expect(tracker).toBe('ip:190.0.0.1:/api/auth/login');
  });

  it('separates routes, so a burst on one does not spend another route quota', async () => {
    const login = await guard.track({ ip: '1.2.3.4', path: '/api/auth/login', headers: {} });
    const forgot = await guard.track({
      ip: '1.2.3.4',
      path: '/api/auth/forgot-password',
      headers: {},
    });
    expect(login).not.toBe(forgot);
  });

  it('separates the same user across routes', async () => {
    const headers = { authorization: bearerFor('user-ana') };
    const a = await guard.track({ ip: '1.2.3.4', path: '/api/work-orders', headers });
    const b = await guard.track({ ip: '1.2.3.4', path: '/api/customers', headers });
    expect(a).not.toBe(b);
  });

  it.each([
    ['malformed token', 'Bearer not-a-jwt'],
    ['payload that is not JSON', 'Bearer header.bm90LWpzb24.sig'],
    [
      'token without sub',
      `Bearer header.${Buffer.from('{"tenantId":"t1"}').toString('base64url')}.s`,
    ],
    ['wrong scheme', 'Basic dXNlcjpwYXNz'],
    ['empty header', ''],
  ])('falls back to the IP with a %s', async (_label, authorization) => {
    const tracker = await guard.track({
      ip: '190.0.0.9',
      path: '/api/work-orders',
      headers: { authorization },
    });
    expect(tracker).toBe('ip:190.0.0.9:/api/work-orders');
  });

  it('never throws on a hostile token (a rate limiter must not be a crash vector)', async () => {
    await expect(
      guard.track({
        ip: '1.1.1.1',
        path: '/api/work-orders',
        headers: { authorization: 'Bearer a.' + 'A'.repeat(5000) + '.c' },
      }),
    ).resolves.toContain('ip:1.1.1.1');
  });
});
