import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditAction, RoleName } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuditActionMeta } from '../../common/interceptors/audit-log.interceptor';
import { CreateCaseDto } from '../dto/create-case.dto';
import { UpdateCaseDto } from '../dto/update-case.dto';
import { CasesService } from '../services/cases.service';

@ApiTags('cases')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('cases')
export class CasesController {
  constructor(private readonly casesService: CasesService) {}

  @Get()
  findAll() {
    return this.casesService.findAll();
  }

  @Get(':id')
  @AuditActionMeta(AuditAction.CASE_VIEWED)
  findOne(@Param('id') id: string) {
    return this.casesService.findById(id);
  }

  @Post()
  @Roles(RoleName.SUPER_ADMIN, RoleName.SYSTEM_ADMIN, RoleName.NGO_ADMIN, RoleName.NGO_WORKER, RoleName.CASE_MANAGER)
  @AuditActionMeta(AuditAction.CASE_CREATED)
  create(@Body() dto: CreateCaseDto, @CurrentUser('id') userId: string) {
    return this.casesService.create(dto, userId);
  }

  @Patch(':id')
  @Roles(RoleName.SUPER_ADMIN, RoleName.SYSTEM_ADMIN, RoleName.NGO_ADMIN, RoleName.NGO_WORKER, RoleName.CASE_MANAGER)
  @AuditActionMeta(AuditAction.CASE_UPDATED)
  update(@Param('id') id: string, @Body() dto: UpdateCaseDto) {
    return this.casesService.update(id, dto);
  }
}
