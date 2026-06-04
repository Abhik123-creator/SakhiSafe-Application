import { Body, Controller, Get, Post, Put, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditAction, RoleName } from '@prisma/client';
import { memoryStorage } from 'multer';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuditActionMeta } from '../../common/interceptors/audit-log.interceptor';
import { SystemMaintenanceDto } from '../dto/system-maintenance.dto';
import { UpdateSystemSettingsDto } from '../dto/update-system-settings.dto';
import { BrandingUploadFile, SystemSettingsService } from '../services/system-settings.service';

@ApiTags('system-settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleName.SUPER_ADMIN)
@Controller('api/v1/system-settings')
export class SystemSettingsController {
  constructor(private readonly systemSettingsService: SystemSettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get redacted system settings for super admins' })
  findAll() {
    return this.systemSettingsService.getSettings();
  }

  @Put()
  @AuditActionMeta(AuditAction.SYSTEM_SETTINGS_UPDATED)
  @ApiOperation({ summary: 'Update system settings for super admins' })
  update(@Body() dto: UpdateSystemSettingsDto, @Req() request: any) {
    return this.systemSettingsService.updateSettings(dto, request.user?.id);
  }

  @Post('branding/logo')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } }))
  @AuditActionMeta(AuditAction.SYSTEM_SETTINGS_UPDATED)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiOperation({ summary: 'Upload the application logo and favicon identity image' })
  uploadBrandingLogo(@UploadedFile() file: BrandingUploadFile, @Req() request: any) {
    return this.systemSettingsService.uploadBrandingLogo(file, request.user?.id);
  }

  @Get('info')
  @ApiOperation({ summary: 'Get sanitized system information for super admins' })
  info() {
    return this.systemSettingsService.getSystemInfo();
  }

  @Post('maintenance')
  @AuditActionMeta(AuditAction.SYSTEM_MAINTENANCE_REQUESTED)
  @ApiOperation({ summary: 'Record a privileged maintenance request' })
  maintenance(@Body() dto: SystemMaintenanceDto) {
    return this.systemSettingsService.requestMaintenance(dto.action);
  }
}
