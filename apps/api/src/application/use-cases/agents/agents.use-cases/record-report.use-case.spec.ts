import { RecordReportUseCase } from './record-report.use-case';

describe('RecordReportUseCase', () => {
  it('creates a READY report record with the given PDF key and a generatedAt timestamp', async () => {
    const reports = { create: jest.fn().mockResolvedValue(undefined) };
    const useCase = new RecordReportUseCase(reports as never);
    const periodStart = new Date('2026-06-01');
    const periodEnd = new Date('2026-06-30');

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      type: 'MONTHLY',
      periodStart,
      periodEnd,
      pdfR2Key: 'tenant-1/reports/r1.pdf',
    });

    expect(result.status).toBe('READY');
    expect(reports.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: result.id,
        status: 'READY',
        pdfR2Key: 'tenant-1/reports/r1.pdf',
        generatedAt: expect.any(Date),
      }),
    );
  });
});
