import { Module } from '@nestjs/common';
import { PublicBrandingController } from './controllers/public-branding.controller';
import { SystemSettingsController } from './controllers/system-settings.controller';
import { SystemSettingsRepository } from './repositories/system-settings.repository';
import { SystemSettingsService } from './services/system-settings.service';

@Module({
  controllers: [SystemSettingsController, PublicBrandingController],
  providers: [SystemSettingsService, SystemSettingsRepository],
  exports: [SystemSettingsService],
})
export class SystemSettingsModule {}
