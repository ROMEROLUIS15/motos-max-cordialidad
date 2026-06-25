import { Body, Controller, Get, Inject, Param, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { JWTPayload } from '../../../application/ports/jwt.port';
import { CreateBranchUseCase, CreateBranchInput } from '../../../application/use-cases/identity/create-branch.use-case';
import { BranchRepository, BRANCH_REPOSITORY } from '../../../domain/repositories/branch.repository';

@Controller('branches')
@UseGuards(JwtAuthGuard)
export class BranchesController {
  constructor(
    private readonly createBranchUseCase: CreateBranchUseCase,
    @Inject(BRANCH_REPOSITORY) private readonly branchRepo: BranchRepository,
  ) {}

  @Get()
  async findAll(@CurrentUser() user: JWTPayload) {
    return this.branchRepo.findByTenant(user.tenantId);
  }

  @Post()
  async create(
    @CurrentUser() user: JWTPayload,
    @Body() body: Omit<CreateBranchInput, 'tenantId'>,
  ) {
    return this.createBranchUseCase.execute({ ...body, tenantId: user.tenantId });
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @CurrentUser() user: JWTPayload,
    @Body() body: Record<string, unknown>,
  ) {
    const branch = await this.branchRepo.findById(id, user.tenantId);
    if (!branch) return null;
    if (body['isActive'] === false) branch.deactivate();
    if (body['isActive'] === true) branch.activate();
    if (typeof body['name'] === 'string') branch.name = body['name'];
    if (typeof body['address'] === 'string') branch.address = body['address'];
    await this.branchRepo.save(branch);
    return branch;
  }
}
