import { Module } from '@nestjs/common';
import { CareSeekersRepository } from '../../care-seekers/repositories/care-seekers.repository';
import { CareSeekersService } from '../../care-seekers/services/care-seekers.service';
import { InternalAuthModule } from '../internal-auth/internal-auth.module';
import { InternalCareSeekersController } from './internal-care-seekers.controller';

@Module({
  imports: [InternalAuthModule],
  controllers: [InternalCareSeekersController],
  providers: [CareSeekersService, CareSeekersRepository],
})
export class InternalCareSeekersModule {}
