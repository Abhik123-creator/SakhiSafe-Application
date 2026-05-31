import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { AuditAction, ModuleKey, PermissionAction } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuditActionMeta } from '../../common/interceptors/audit-log.interceptor';
import { CreateCareSeekerDto } from '../dto/create-care-seeker.dto';
import { UpdateCareSeekerDto } from '../dto/update-care-seeker.dto';
import { CareSeekersService } from '../services/care-seekers.service';

@ApiTags('care-seekers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('api/v1/care-seekers')
export class CareSeekersController {
  constructor(private readonly careSeekersService: CareSeekersService) {}

  @Get()
  @RequirePermission(ModuleKey.CARE_SEEKERS, PermissionAction.VIEW)
  findAll() {
    return this.careSeekersService.findAll();
  }

  @Get('by-phone/:phone')
  @RequirePermission(ModuleKey.CARE_SEEKERS, PermissionAction.VIEW)
  @ApiOperation({ summary: 'Get care seeker by phone number' })
  @ApiParam({ name: 'phone', example: '917003801171' })
  findByPhone(@Param('phone') phone: string) {
    return this.careSeekersService.findByPhone(phone);
  }

  @Get(':id')
  @RequirePermission(ModuleKey.CARE_SEEKERS, PermissionAction.VIEW)
  @AuditActionMeta(AuditAction.CARE_SEEKER_VIEWED)
  findOne(@Param('id') id: string) {
    return this.careSeekersService.findById(id);
  }

  @Post()
  @RequirePermission(ModuleKey.CARE_SEEKERS, PermissionAction.CREATE)
  create(@Body() dto: CreateCareSeekerDto) {
    return this.careSeekersService.create(dto);
  }

  @Patch(':id')
  @RequirePermission(ModuleKey.CARE_SEEKERS, PermissionAction.UPDATE)
  @AuditActionMeta(AuditAction.CARE_SEEKER_UPDATED)
  update(@Param('id') id: string, @Body() dto: UpdateCareSeekerDto) {
    return this.careSeekersService.update(id, dto);
  }
}
