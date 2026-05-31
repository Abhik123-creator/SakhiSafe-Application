import { Module } from '@nestjs/common';
import { InternalCareSeekersModule } from './care-seekers/internal-care-seekers.module';
import { InternalCasesModule } from './cases/internal-cases.module';
import { InternalAuthModule } from './internal-auth/internal-auth.module';
import { InternalHealthController } from './internal-auth/internal-health.controller';

@Module({
  imports: [InternalAuthModule, InternalCareSeekersModule, InternalCasesModule],
  controllers: [InternalHealthController],
})
export class InternalModule {}
