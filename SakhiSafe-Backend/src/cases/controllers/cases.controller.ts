import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditAction, ModuleKey, PermissionAction } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuditActionMeta } from '../../common/interceptors/audit-log.interceptor';
import { CreateCaseDto } from '../dto/create-case.dto';
import { UpdateCaseDto } from '../dto/update-case.dto';
import { CasesService } from '../services/cases.service';

@ApiTags('cases')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('cases')
export class CasesController {
  constructor(private readonly casesService: CasesService) {}

  @Get()
  @RequirePermission(ModuleKey.CASES, PermissionAction.VIEW)
  findAll() {
    return this.casesService.findAll();
  }

  @Get(':id')
  @RequirePermission(ModuleKey.CASES, PermissionAction.VIEW)
  @AuditActionMeta(AuditAction.CASE_VIEWED)
  findOne(@Param('id') id: string) {
    return this.casesService.findById(id);
  }

  @Post()
  @RequirePermission(ModuleKey.CASES, PermissionAction.CREATE)
  @AuditActionMeta(AuditAction.CASE_CREATED)
  create(@Body() dto: CreateCaseDto, @CurrentUser('id') userId: string) {
    return this.casesService.create(dto, userId);
  }

  @Patch(':id')
  @RequirePermission(ModuleKey.CASES, PermissionAction.UPDATE)
  @AuditActionMeta(AuditAction.CASE_UPDATED)
  update(@Param('id') id: string, @Body() dto: UpdateCaseDto) {
    return this.casesService.update(id, dto);
  }
}
