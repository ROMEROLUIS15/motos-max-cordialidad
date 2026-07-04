import { GenerateReportUseCase } from './generate-report.use-case';

describe('GenerateReportUseCase', () => {
  it('creates a PENDING report record for the given period and returns its id', async () => {
    const reports = { create: jest.fn().mockResolvedValue(undefined) };
    const useCase = new GenerateReportUseCase(reports as never);
    const periodStart = new Date('2026-06-01');
    const periodEnd = new Date('2026-06-30');

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      type: 'MONTHLY',
      periodStart,
      periodEnd,
    });

    expect(result.status).toBe('PENDING');
    expect(reports.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: result.id,
        tenantId: 'tenant-1',
        type: 'MONTHLY',
        periodStart,
        periodEnd,
        pdfR2Key: null,
        status: 'PENDING',
        generatedAt: null,
      }),
    );
  });
});
