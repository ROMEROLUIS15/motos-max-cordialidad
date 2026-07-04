import { CleanupExpiredTokensJob } from './cleanup-expired-tokens.job';

describe('CleanupExpiredTokensJob', () => {
  it('delegates to the repository and logs how many expired unused tokens were deleted', async () => {
    const tokens = { deleteExpiredUnused: jest.fn().mockResolvedValue(3) };
    const job = new CleanupExpiredTokensJob(tokens as never);

    await job.handle();

    expect(tokens.deleteExpiredUnused).toHaveBeenCalled();
  });
});
