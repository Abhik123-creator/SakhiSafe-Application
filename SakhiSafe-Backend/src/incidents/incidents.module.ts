import { Module } from '@nestjs/common';
import { AdminIncidentsController } from './controllers/admin-incidents.controller';
import { IncidentsRepository } from './repositories/incidents.repository';
import { IncidentsService } from './services/incidents.service';

@Module({
  controllers: [AdminIncidentsController],
  providers: [IncidentsService, IncidentsRepository],
  exports: [IncidentsService, IncidentsRepository],
})
export class IncidentsModule {}
