import { GetReportDownloadUrlUseCase } from './get-report-download-url.use-case';

function make() {
  const reports = { findById: jest.fn() };
  const storage = {
    getSignedUrl: jest.fn().mockResolvedValue('https://signed.example/report.pdf'),
  };
  const useCase = new GetReportDownloadUrlUseCase(reports as never, storage as never);
  return { useCase, reports, storage };
}

describe('GetReportDownloadUrlUseCase', () => {
  it('returns NOT_FOUND when the report does not exist for the tenant', async () => {
    const { useCase, reports } = make();
    reports.findById.mockResolvedValue(null);
    await expect(useCase.execute('report-1', 'tenant-1')).resolves.toEqual({ status: 'NOT_FOUND' });
  });

  it('returns NOT_READY (with the current status) when the report is not yet READY', async () => {
    const { useCase, reports } = make();
    reports.findById.mockResolvedValue({ status: 'PENDING', pdfR2Key: null });
    await expect(useCase.execute('report-1', 'tenant-1')).resolves.toEqual({
      status: 'NOT_READY',
      reportStatus: 'PENDING',
    });
  });

  it('returns a short-lived signed url (15 min) when the report is READY', async () => {
    const { useCase, reports, storage } = make();
    reports.findById.mockResolvedValue({ status: 'READY', pdfR2Key: 'tenant-1/reports/r1.pdf' });

    const result = await useCase.execute('report-1', 'tenant-1');

    expect(storage.getSignedUrl).toHaveBeenCalledWith('tenant-1/reports/r1.pdf', 900);
    expect(result).toEqual({
      status: 'OK',
      url: 'https://signed.example/report.pdf',
      expiresInSeconds: 900,
    });
  });
});
