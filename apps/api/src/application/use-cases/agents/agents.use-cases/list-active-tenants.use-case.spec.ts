import { ListActiveTenantsUseCase } from './list-active-tenants.use-case';

describe('ListActiveTenantsUseCase', () => {
  it('maps active tenants to their public summary shape', async () => {
    const tenants = {
      findActive: jest
        .fn()
        .mockResolvedValue([
          {
            id: 't1',
            name: 'Taller Demo',
            taxId: '900123456-1',
            whatsappPhone: '3000000000',
            whatsappToken: 'secret',
          },
        ]),
    };
    const useCase = new ListActiveTenantsUseCase(tenants as never);

    const result = await useCase.execute();

    expect(result).toEqual([
      { id: 't1', name: 'Taller Demo', taxId: '900123456-1', whatsappPhone: '3000000000' },
    ]);
    expect(result[0]).not.toHaveProperty('whatsappToken');
  });
});
