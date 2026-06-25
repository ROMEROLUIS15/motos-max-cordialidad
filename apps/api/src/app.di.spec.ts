import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';
import { PrismaService } from './infrastructure/persistence/prisma/prisma.service';

/**
 * DI smoke test: builds the full dependency graph from AppModule without
 * touching the database. If any provider/token cannot be resolved, compile()
 * throws and this test fails. Guards against the "interface injected without
 * @Inject token" class of bugs.
 */
describe('AppModule dependency injection', () => {
  it('resolves the entire provider graph', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({ $connect: jest.fn(), $disconnect: jest.fn() })
      .compile();

    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  });
});
