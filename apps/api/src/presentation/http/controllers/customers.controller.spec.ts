import { CustomersController } from './customers.controller';
import { JWTPayload } from '../../../application/ports/jwt.port';

/**
 * Regression guard for the cross-tenant override vulnerability: the request body
 * must never be able to override the tenantId (or the resource id) derived from
 * the authenticated user's token. The controller spreads `...body` first and
 * applies the trusted fields last, so a hostile body cannot win.
 */
describe('CustomersController — tenant override protection', () => {
  const user = { tenantId: 'tenant-legit', sub: 'u1', roleId: 'r1' } as JWTPayload;

  it('update ignores a body-supplied tenantId and customerId, using the token + path', async () => {
    const updateCustomer = { execute: jest.fn().mockResolvedValue(undefined) };
    const controller = new CustomersController(
      {} as never,
      updateCustomer as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const hostileBody = {
      fullName: 'Nuevo',
      tenantId: 'tenant-victim',
      customerId: 'victim-customer',
    } as never;

    await controller.update('path-customer', user, hostileBody);

    const arg = updateCustomer.execute.mock.calls[0][0];
    expect(arg.tenantId).toBe('tenant-legit');
    expect(arg.customerId).toBe('path-customer');
    expect(arg.fullName).toBe('Nuevo');
  });

  it('create ignores a body-supplied tenantId, using the token', async () => {
    const registerCustomer = { execute: jest.fn().mockResolvedValue({ id: 'c1' }) };
    const controller = new CustomersController(
      registerCustomer as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await controller.create(user, { fullName: 'X', tenantId: 'tenant-victim' } as never);

    expect(registerCustomer.execute.mock.calls[0][0].tenantId).toBe('tenant-legit');
  });
});
