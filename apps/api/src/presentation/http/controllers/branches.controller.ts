import { Body, Controller, Get, Inject, Param, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { JWTPayload } from '../../../application/ports/jwt.port';
import { CreateBranchUseCase } from '../../../application/use-cases/identity/create-branch.use-case';
import {
  BranchRepository,
  BRANCH_REPOSITORY,
} from '../../../domain/repositories/branch.repository';
import { UpdateBranchDto } from '../dtos/update-branch.dto';
import { CreateBranchDto } from '../dtos/create-branch.dto';

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
  async create(@CurrentUser() user: JWTPayload, @Body() body: CreateBranchDto) {
    return this.createBranchUseCase.execute({ ...body, tenantId: user.tenantId });
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @CurrentUser() user: JWTPayload,
    @Body() body: UpdateBranchDto,
  ) {
    const branch = await this.branchRepo.findById(id, user.tenantId);
    if (!branch) return null;
    if (body.isActive === false) branch.deactivate();
    if (body.isActive === true) branch.activate();
    if (body.name !== undefined) branch.name = body.name;
    if (body.address !== undefined) branch.address = body.address;
    await this.branchRepo.save(branch);
    return branch;
  }
}
