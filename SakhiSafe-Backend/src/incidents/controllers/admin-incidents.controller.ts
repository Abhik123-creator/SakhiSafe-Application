import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ModuleKey, PermissionAction } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { ListIncidentsDto } from '../dto/list-incidents.dto';
import { UpdateIncidentDto } from '../dto/update-incident.dto';
import { IncidentsService } from '../services/incidents.service';

@ApiTags('admin incidents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('admin/v1/incidents')
export class AdminIncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Get()
  @RequirePermission(ModuleKey.INCIDENTS, PermissionAction.VIEW)
  findAll(@Query() filters: ListIncidentsDto) {
    return this.incidentsService.findAll(filters);
  }

  @Get(':id')
  @RequirePermission(ModuleKey.INCIDENTS, PermissionAction.VIEW)
  findOne(@Param('id') id: string) {
    return this.incidentsService.findById(id);
  }

  @Patch(':id')
  @RequirePermission(ModuleKey.INCIDENTS, PermissionAction.UPDATE)
  update(@Param('id') id: string, @Body() dto: UpdateIncidentDto) {
    return this.incidentsService.update(id, dto);
  }
}
