import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SystemSettingsService } from '../services/system-settings.service';

@ApiTags('public-branding')
@Controller('api/v1/public/branding')
export class PublicBrandingController {
  constructor(private readonly systemSettingsService: SystemSettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get public application branding identity' })
  findPublicBranding() {
    return this.systemSettingsService.getPublicBranding();
  }
}
