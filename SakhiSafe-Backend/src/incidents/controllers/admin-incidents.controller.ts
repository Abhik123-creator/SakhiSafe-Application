import { Body, Controller, Get, Headers, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ModuleKey, PermissionAction, RoleName } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { EvidenceAccessService } from '../../common/services/evidence-access.service';
import { extractRoleNames } from '../../common/utils/extract-role-names.util';
import { ListIncidentsDto } from '../dto/list-incidents.dto';
import { UpdateIncidentDto } from '../dto/update-incident.dto';
import { IncidentsService } from '../services/incidents.service';

@ApiTags('admin incidents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('admin/v1/incidents')
export class AdminIncidentsController {
  constructor(
    private readonly incidentsService: IncidentsService,
    private readonly evidenceAccessService: EvidenceAccessService,
  ) {}

  @Get()
  @RequirePermission(ModuleKey.INCIDENTS, PermissionAction.VIEW)
  findAll(@Query() filters: ListIncidentsDto) {
    return this.incidentsService.findAll(filters);
  }

  @Get(':id')
  @RequirePermission(ModuleKey.INCIDENTS, PermissionAction.VIEW)
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Headers('x-evidence-access-code') accessCode?: string,
  ) {
    const roles = extractRoleNames(user);
    const isAdmin = roles.includes(RoleName.SUPER_ADMIN) || roles.includes(RoleName.ADMIN);
    const includeEvidence = isAdmin || Boolean(accessCode);

    if (!isAdmin && accessCode) {
      await this.evidenceAccessService.assertEvidenceAccess(user, accessCode, `incident:${id}:detail:evidence`);
    }

    return this.incidentsService.findById(id, { includeEvidence });
  }

  @Patch(':id')
  @RequirePermission(ModuleKey.INCIDENTS, PermissionAction.UPDATE)
  update(@Param('id') id: string, @Body() dto: UpdateIncidentDto) {
    return this.incidentsService.update(id, dto);
  }
}
