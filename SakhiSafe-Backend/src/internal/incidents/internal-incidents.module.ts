import { Module } from '@nestjs/common';
import { IncidentsModule } from '../../incidents/incidents.module';
import { InternalAuthModule } from '../internal-auth/internal-auth.module';
import { InternalIncidentsController } from './internal-incidents.controller';

@Module({
  imports: [InternalAuthModule, IncidentsModule],
  controllers: [InternalIncidentsController],
})
export class InternalIncidentsModule {}
