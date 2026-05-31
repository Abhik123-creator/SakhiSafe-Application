import { Module } from '@nestjs/common';
import { InternalHealthController } from './internal-auth/internal-health.controller';

@Module({
  controllers: [InternalHealthController],
})
export class InternalModule {}
