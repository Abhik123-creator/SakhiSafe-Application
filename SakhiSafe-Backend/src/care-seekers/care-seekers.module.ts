import { Module } from '@nestjs/common';
import { CareSeekersController } from './controllers/care-seekers.controller';
import { CareSeekersRepository } from './repositories/care-seekers.repository';
import { CareSeekersService } from './services/care-seekers.service';

@Module({
  controllers: [CareSeekersController],
  providers: [CareSeekersService, CareSeekersRepository],
  exports: [CareSeekersService],
})
export class CareSeekersModule {}
