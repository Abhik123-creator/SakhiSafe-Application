import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditAction, RoleName } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuditActionMeta } from '../../common/interceptors/audit-log.interceptor';
import { UpdateRolePermissionsDto } from '../dto/update-role-permissions.dto';
import { PermissionsService } from '../services/permissions.service';

@ApiTags('permissions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleName.SUPER_ADMIN)
@Controller('api/v1/roles/:roleId/permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  findByRole(@Param('roleId') roleId: string) {
    return this.permissionsService.findByRole(roleId);
  }

  @Put()
  @AuditActionMeta(AuditAction.PERMISSIONS_UPDATED)
  updateRolePermissions(@Param('roleId') roleId: string, @Body() dto: UpdateRolePermissionsDto) {
    return this.permissionsService.updateRolePermissions(roleId, dto);
  }
}
