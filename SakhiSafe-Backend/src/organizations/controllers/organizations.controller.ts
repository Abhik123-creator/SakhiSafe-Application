import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditAction, ModuleKey, PermissionAction } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AuditActionMeta } from '../../common/interceptors/audit-log.interceptor';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateOrganizationDto } from '../dto/create-organization.dto';
import { UpdateOrganizationDto } from '../dto/update-organization.dto';
import { OrganizationsService } from '../services/organizations.service';

@ApiTags('organizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  @RequirePermission(ModuleKey.ORGANIZATIONS, PermissionAction.VIEW)
  findAll() {
    return this.organizationsService.findAll();
  }

  @Get(':id')
  @RequirePermission(ModuleKey.ORGANIZATIONS, PermissionAction.VIEW)
  findOne(@Param('id') id: string) {
    return this.organizationsService.findById(id);
  }

  @Post()
  @RequirePermission(ModuleKey.ORGANIZATIONS, PermissionAction.CREATE)
  @AuditActionMeta(AuditAction.ORGANIZATION_CREATED)
  create(@Body() dto: CreateOrganizationDto) {
    return this.organizationsService.create(dto);
  }

  @Patch(':id')
  @RequirePermission(ModuleKey.ORGANIZATIONS, PermissionAction.UPDATE)
  @AuditActionMeta(AuditAction.ORGANIZATION_UPDATED)
  update(@Param('id') id: string, @Body() dto: UpdateOrganizationDto) {
    return this.organizationsService.update(id, dto);
  }
}
